"""Cohorte simulada para probar el entrenamiento — ESP-005.

NO son datos del estudio. Sirven para ejercitar `semanas_modelo`, `entrenar.py`
y las pruebas de §10 con un volumen parecido al que proyecta §2 (60-100
personas), antes de tener la muestra real.

El requisito de diseño es que el problema sea **difícil de la manera correcta**.
La semilla de demostración (`DEMO-*`) genera los datos con una fórmula que el
modelo recupera casi perfecto (ROC-AUC 0.99), que es justo el fracaso que
describe ESP-005 §1. Aquí el OLBI del viernes y los ítems diarios comparten un
estado latente pero **no comparten el ruido**: son dos instrumentos distintos,
con escalas distintas, aplicados en momentos distintos. Esa separación es lo
que impide que el modelo lea la etiqueta en las entradas.

Proceso generativo (tres niveles, como el estudio de referencia):

  persona   θ ~ N(0,1), propensión estable. Da el ICC ≈ 0.5 observado en
            Gruszczynska et al. (2021). El contexto laboral (carga estructural,
            apoyo del líder, rol, modalidad) se correlaciona con θ sin
            determinarlo: así los rasgos propios de §4.2 llevan señal real y la
            comparación A vs. A₀ significa algo.

  semana    s_w = φ·s_{w-1} + efecto(presión de la semana) + ruido. AR(1): el
            agotamiento tiene inercia. La presión semanal mueve también las
            horas, el sobretiempo y las guardias.

  día       u_d = φ_d·u_{d-1} + ruido, con autocorrelación 0.4-0.6 como en la
            referencia. Los cuatro ítems od_* salen de (θ + s_w + u_d) más
            error de medición, discretizados a 1-5.

  viernes   Los 16 ítems del OLBI salen de (θ + s_w) más un error de medición
            INDEPENDIENTE del de los días, en escala 1-4. La etiqueta es el
            umbral de ESP-003 sobre las dimensiones puntuadas.

Además:
  - La adherencia no es perfecta y **baja cuando la persona se está quemando**:
    dejar de responder es señal, no solo ruido (ESP-005 §4.2).
  - Quien cruza el umbral sale del seguimiento (RN-007-04): no se generan más
    semanas para esa persona.

Uso:
    modelo/exploracion/venv/bin/python modelo/simular.py --calibrar     # solo estadísticas
    modelo/exploracion/venv/bin/python modelo/simular.py --cargar       # inserta SIM-*
    modelo/exploracion/venv/bin/python modelo/simular.py --limpiar      # borra SIM-*
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

import numpy as np
import psycopg

DSN = ("postgresql://postgres.tnllaabrtntlmobtnhfp:{clave}"
       "@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
ORG = 'Cohorte simulada (ESP-005)'
PREFIJO = 'SIM-'
TZ = timezone(timedelta(hours=-5))  # America/Lima

# --------------------------------------------------------------- parámetros
# Anclados en Gruszczynska, Basinska y Schaufeli (2021) donde se pudo medir
# (modelo/exploracion/README.md) y en ESP-005 §7.3 para la prevalencia.

N_PERSONAS = 80
SEMANAS = 6

ICC = 0.50          # varianza entre personas / total, referencia ≈ 0.51
AUTOCORR_DIA = 0.50     # referencia 0.40-0.60
AUTOCORR_SEMANA = 0.55
COR_E_D = 0.80          # agotamiento-desvinculación, referencia 0.75-0.83

MEDIA_DIARIA = 2.23     # media de T en la referencia
DE_DIARIA = 0.83

# Ruido de medición del OLBI del viernes, en desviaciones del estado latente.
# Es el parámetro que decide si la tarea es aprendible o trivial: con 0 el
# modelo leería la etiqueta en los ítems diarios.
RUIDO_OLBI = 0.95
RUIDO_ITEM_OLBI = 0.55  # error por ítem dentro del cuestionario

# Centro y escala del OLBI latente. Se eligieron por barrido para que la
# prevalencia de semanas altas caiga en el 10-25 % que espera ESP-005 §7.3 y
# para que la media y la dispersión diarias se parezcan a la referencia.
CENTRO_OLBI = 2.20
ESCALA_OLBI = 0.28

# Error de medición del estado diario, aparte del error por ítem. Sube la
# variación dentro de la persona hasta dejar el ICC y la autocorrelación en el
# rango de la referencia.
RUIDO_DIA = 0.70

ADHERENCIA_MEDIA = 0.78
CAIDA_POR_SEMANA = 0.02   # el cansancio del protocolo
CAIDA_POR_BURNOUT = 0.14  # quien peor está, menos responde

ROLES = ['desarrollo', 'qa', 'datos', 'infraestructura', 'soporte', 'diseno', 'gestion', 'otro']
PESO_ROL = [0.34, 0.11, 0.12, 0.13, 0.09, 0.08, 0.10, 0.03]
MODALIDADES = ['remoto', 'hibrido', 'presencial']
PESO_MODALIDAD = [0.42, 0.45, 0.13]
# Cuánto aporta cada rol a la carga estructural (soporte y guardias pesan más).
CARGA_ROL = {'desarrollo': 0.05, 'qa': -0.05, 'datos': -0.05, 'infraestructura': 0.30,
             'soporte': 0.35, 'diseno': -0.10, 'gestion': 0.20, 'otro': 0.0}

UMBRAL_AGOTAMIENTO = 2.875
UMBRAL_DESVINCULACION = 2.75
OLBI_MIN, OLBI_MAX = 1, 4

# dimensión e inversión de cada ítem del OLBI (formularios.definicion)
ITEMS_OLBI = [
    ('olbi_01', 'desvinculacion', True), ('olbi_02', 'agotamiento', False),
    ('olbi_03', 'desvinculacion', False), ('olbi_04', 'agotamiento', False),
    ('olbi_05', 'agotamiento', True), ('olbi_06', 'desvinculacion', False),
    ('olbi_07', 'desvinculacion', True), ('olbi_08', 'agotamiento', False),
    ('olbi_09', 'desvinculacion', False), ('olbi_10', 'agotamiento', True),
    ('olbi_11', 'desvinculacion', False), ('olbi_12', 'agotamiento', False),
    ('olbi_13', 'desvinculacion', True), ('olbi_14', 'agotamiento', True),
    ('olbi_15', 'desvinculacion', True), ('olbi_16', 'agotamiento', True),
]


def discretizar(x: float, lo: int, hi: int) -> int:
    return int(np.clip(round(x), lo, hi))


# ------------------------------------------------------------------ persona

def generar_persona(rng: np.random.Generator, idx: int, sesgo: float = 0.0) -> dict:
    """`sesgo` desplaza la propensión de toda una empresa: positivo para una
    con más carga estructural, negativo para una con mejor clima. Permite que
    varias cohortes simuladas no salgan idénticas."""
    theta = rng.normal(sesgo, 1)
    rol = rng.choice(ROLES, p=PESO_ROL)
    modalidad = rng.choice(MODALIDADES, p=PESO_MODALIDAD)

    # El contexto se correlaciona con θ sin determinarlo: parte de la
    # propensión es explicable por la carga y parte no lo es.
    carga = 0.55 * theta + CARGA_ROL[str(rol)] + rng.normal(0, 0.8)
    apoyo_lider = float(np.clip(rng.normal(3.4 - 0.45 * theta, 0.9), 1, 5))

    edad = float(np.clip(rng.normal(31, 6), 21, 58).round())
    antiguedad_empresa = float(np.clip(rng.gamma(1.8, 1.4), 0, 20).round(1))
    return {
        'idx': idx,
        'theta': theta,
        'carga': carga,
        'rol': str(rol),
        'modalidad': str(modalidad),
        'apoyo_lider': apoyo_lider,
        'adherencia': float(np.clip(rng.beta(6, 6 * (1 - ADHERENCIA_MEDIA) / ADHERENCIA_MEDIA), 0.25, 0.99)),
        'estable': {
            'edad': edad,
            'antiguedad_empresa': antiguedad_empresa,
            'antiguedad_sector': float(np.clip(antiguedad_empresa + rng.gamma(2, 1.5), 0, 30).round(1)),
            'tamano_equipo': float(np.clip(rng.normal(8, 4), 2, 40).round()),
            'personas_a_cargo': float(max(0, round(rng.gamma(0.6, 3) if modalidad != 'presencial' else rng.gamma(0.5, 2)))),
            'minutos_traslado': float(0 if modalidad == 'remoto' else np.clip(rng.gamma(3, 15), 5, 150).round()),
        },
        'horas_base': float(np.clip(rng.normal(8.4 + 0.45 * carga, 0.7), 6, 12)),
        'sueno_base': float(np.clip(rng.normal(7.1 - 0.35 * theta, 0.7), 4, 9.5)),
    }


# ------------------------------------------------------------------ semanas

def generar_seguimiento(p: dict, rng: np.random.Generator) -> list[dict]:
    """Semanas de una persona hasta su primer cruce inclusive (RN-007-04)."""
    # Descomposición del estado latente: parte estable (θ) y parte semanal.
    de_persona = np.sqrt(ICC)
    de_semana = np.sqrt(1 - ICC)

    s = rng.normal(0, de_semana)
    semanas = []
    for w in range(SEMANAS):
        # Presión de la semana: cierres de proyecto, incidentes. Mueve el
        # estado y, a la vez, las horas y el sobretiempo: correlación real
        # entre los rasgos propios y la etiqueta, no artificial.
        presion = rng.normal(0.25 * p['carga'], 0.9)
        s = AUTOCORR_SEMANA * s + 0.35 * presion + rng.normal(0, de_semana * 0.8)

        latente = de_persona * p['theta'] + s
        guardias = float(rng.random() < 1 / (1 + np.exp(-(-1.4 + 0.7 * presion + CARGA_ROL[p['rol']] * 2))))
        dias = generar_dias(p, latente, presion, w, rng, guardias)
        semanal = {
            'horas_sobretiempo': float(np.clip(rng.normal(3.0 + 1.9 * presion, 2.2), 0, 25).round(1)),
            'guardias': guardias,
            'apoyo_lider': float(np.clip(rng.normal(p['apoyo_lider'], 0.5), 1, 5).round()),
        }
        olbi, agotamiento, desvinculacion = generar_olbi(latente, rng)
        alto = agotamiento >= UMBRAL_AGOTAMIENTO or desvinculacion >= UMBRAL_DESVINCULACION

        semanas.append({'semana': w, 'dias': dias, 'semanal': semanal, 'olbi': olbi,
                        'agotamiento': agotamiento, 'desvinculacion': desvinculacion,
                        'alto': alto, 'latente': latente})
        if alto:
            break  # sale del seguimiento
    return semanas


def generar_dias(p: dict, latente: float, presion: float, w: int,
                 rng: np.random.Generator, guardias: float = 0.0) -> list[dict]:
    """Lunes a jueves. Devuelve solo los días efectivamente respondidos."""
    u = 0.0
    dias = []
    # Quien está peor responde menos: el hueco es informativo (§4.2 n_dias).
    p_resp = float(np.clip(
        p['adherencia'] - CAIDA_POR_SEMANA * w - CAIDA_POR_BURNOUT * max(0.0, latente), 0.05, 0.99))
    for d in range(4):
        u = AUTOCORR_DIA * u + rng.normal(0, 0.55)
        if rng.random() > p_resp:
            continue
        # Bloque de recuperación (diario v3). La cadena simulada es:
        # presión y guardias -> te contactan -> desconectas peor -> más
        # agotamiento. Es una vía causal plausible, NO una medición: si el
        # modelo la encuentra, encuentra lo que se programó aquí.
        contacto = int(rng.random() < 1 / (1 + np.exp(-(-1.1 + 0.55 * presion + 1.2 * guardias))))
        desconexion = float(np.clip(
            rng.normal(4.0 - 0.40 * presion - 0.85 * contacto, 0.85), 1, 5))
        # Estado del día en la escala 1-5 de los ítems diarios.
        centro = MEDIA_DIARIA + DE_DIARIA * (latente + u)
        e = centro + 0.25 * presion + 0.18 * (3.0 - desconexion) + rng.normal(0, RUIDO_DIA)
        # Desvinculación correlacionada con agotamiento (referencia 0.75-0.83).
        d_lat = COR_E_D * (e - MEDIA_DIARIA) + np.sqrt(1 - COR_E_D ** 2) * rng.normal(0, DE_DIARIA)
        dd = MEDIA_DIARIA + d_lat
        horas = float(np.clip(rng.normal(p['horas_base'] + 0.8 * presion, 1.0), 4, 16))
        dias.append({
            'dow': d,
            'od_04': discretizar(e + rng.normal(0, 0.45), 1, 5),
            'od_12': discretizar(e + rng.normal(0, 0.45), 1, 5),
            'od_03': discretizar(dd + rng.normal(0, 0.45), 1, 5),
            'od_06': discretizar(dd + rng.normal(0, 0.45), 1, 5),
            'horas_trabajadas': round(horas, 1),
            'horas_sueno': round(float(np.clip(rng.normal(p['sueno_base'] - 0.22 * (horas - p['horas_base']), 0.8), 3, 10)), 1),
            # Solo el lunes pregunta por el fin de semana.
            'desconexion': float(round(desconexion)),
            'contacto_fuera_horario': float(contacto),
            'horas_fin_de_semana': round(float(np.clip(rng.gamma(1.2, 1.6) + 0.5 * presion, 0, 16)), 1) if d == 0 else None,
        })
    return dias


def generar_olbi(latente: float, rng: np.random.Generator) -> tuple[dict, float, float]:
    """Los 16 ítems del viernes, escala 1-4.

    El error `RUIDO_OLBI` es independiente del de los días: el OLBI es otro
    instrumento aplicado en otro momento. Sin él, la etiqueta sería una
    función determinista de las entradas y el modelo daría ~1.0 de AUC."""
    e_lat = CENTRO_OLBI + ESCALA_OLBI * latente + rng.normal(0, RUIDO_OLBI * ESCALA_OLBI)
    d_lat = CENTRO_OLBI + ESCALA_OLBI * (COR_E_D * latente + np.sqrt(1 - COR_E_D ** 2) * rng.normal(0, 1)) \
        + rng.normal(0, RUIDO_OLBI * ESCALA_OLBI)

    items, puntajes = {}, {'agotamiento': [], 'desvinculacion': []}
    for clave, dimension, invertido in ITEMS_OLBI:
        base = e_lat if dimension == 'agotamiento' else d_lat
        valor = discretizar(base + rng.normal(0, RUIDO_ITEM_OLBI), OLBI_MIN, OLBI_MAX)
        puntajes[dimension].append(valor)
        # La vista invierte los ítems marcados; se guarda ya invertido para
        # que al puntuarlos vuelva a salir `valor`.
        items[clave] = (OLBI_MIN + OLBI_MAX - valor) if invertido else valor
    return items, float(np.mean(puntajes['agotamiento'])), float(np.mean(puntajes['desvinculacion']))


# --------------------------------------------------------------- estadísticas

def calibracion(cohorte: list[tuple[dict, list[dict]]]) -> dict:
    todas = [s for _, ss in cohorte for s in ss]
    dias = [d for s in todas for d in s['dias']]
    t = np.array([np.mean([d['od_04'], d['od_12'], d['od_03'], d['od_06']]) for d in dias])

    # ICC: varianza de la media por persona sobre varianza total.
    por_persona = [np.mean([np.mean([d['od_04'], d['od_12'], d['od_03'], d['od_06']])
                            for s in ss for d in s['dias']])
                   for _, ss in cohorte if any(s['dias'] for s in ss)]
    icc = float(np.var(por_persona) / np.var(t)) if len(t) > 1 else float('nan')

    # Autocorrelación día a día dentro de la semana.
    pares = []
    for s in todas:
        v = [np.mean([d['od_04'], d['od_12'], d['od_03'], d['od_06']]) for d in s['dias']]
        pares += [(v[i], v[i + 1]) for i in range(len(v) - 1)]
    ac = float(np.corrcoef(*zip(*pares))[0, 1]) if len(pares) > 2 else float('nan')

    n_dias = [len(s['dias']) for s in todas]
    return {
        'personas': len(cohorte),
        'semanas': len(todas),
        'semanas_por_persona': round(len(todas) / len(cohorte), 2),
        'prevalencia_semanas_altas': round(float(np.mean([s['alto'] for s in todas])), 3),
        'personas_que_cruzan': round(float(np.mean([any(s['alto'] for s in ss) for _, ss in cohorte])), 3),
        'T_media': round(float(t.mean()), 2),
        'T_de': round(float(t.std()), 2),
        'ICC': round(icc, 2),
        'autocorr_dia': round(ac, 2),
        'dias_respondidos_media': round(float(np.mean(n_dias)), 2),
        'semanas_sin_ningun_dia': round(float(np.mean([n == 0 for n in n_dias])), 3),
    }


REFERENCIA = {
    'T_media': '2.23 (Gruszczynska 2021)',
    'T_de': '0.83 (Gruszczynska 2021)',
    'ICC': '≈0.51 (Gruszczynska 2021)',
    'autocorr_dia': '0.40-0.60 (Gruszczynska 2021)',
    'prevalencia_semanas_altas': '0.10-0.25 (ESP-005 §7.3)',
}


# ------------------------------------------------------------------- carga

def conectar():
    clave = os.environ.get('SUPABASE_DB_PASSWORD')
    if not clave:
        sys.exit('falta SUPABASE_DB_PASSWORD en el entorno (source ~/.zshrc)')
    cx = psycopg.connect(DSN.format(clave=clave), autocommit=False)
    cx.execute('reset role')
    return cx


def limpiar(cx) -> int:
    """Borra la cohorte SIM-* y, si queda vacía, también su empresa: una
    empresa sin trabajadores solo estorba en el panel del investigador."""
    cur = cx.execute("select id from trabajadores where codigo_anonimo like %s", (PREFIJO + '%',))
    ids = [r[0] for r in cur.fetchall()]
    if ids:
        cx.execute("delete from respuestas_items where respuesta_id in "
                   "(select id from respuestas where trabajador_id = any(%s))", (ids,))
        cx.execute("delete from respuestas where trabajador_id = any(%s)", (ids,))
        cx.execute("delete from eventos where trabajador_id = any(%s)", (ids,))
        cx.execute("delete from trabajadores where id = any(%s)", (ids,))

    org = cx.execute("select id from organizaciones where nombre = %s", (ORG,)).fetchone()
    if org:
        # Solo si de verdad no quedó nada colgando: la empresa se creó para
        # esta cohorte, pero no se borra a ciegas.
        resto = (
            cx.execute("select count(*) from trabajadores where organizacion_id = %s", (org[0],)).fetchone()[0]
            + cx.execute("select count(*) from usuarios_rol where organizacion_id = %s", (org[0],)).fetchone()[0]
            + cx.execute("select count(*) from administradores where organizacion_id = %s", (org[0],)).fetchone()[0]
        )
        if resto == 0:
            cx.execute("delete from organizaciones where id = %s", (org[0],))
            print(f'borrada la empresa «{ORG}» (quedó vacía)')
        else:
            print(f'la empresa «{ORG}» conserva {resto} filas asociadas: no se borra')
    return len(ids)


def cargar(cx, cohorte: list[tuple[dict, list[dict]]], lunes0: date) -> None:
    org = cx.execute("select id from organizaciones where nombre = %s", (ORG,)).fetchone()
    if org:
        org_id = org[0]
    else:
        org_id = cx.execute("insert into organizaciones (nombre) values (%s) returning id",
                            (ORG,)).fetchone()[0]

    respuestas, items = [], []

    def anotar(pid, clave, version, cuando, valores: dict) -> None:
        rid = uuid.uuid4()
        respuestas.append((rid, pid, clave, version, cuando, cuando))
        for k, v in valores.items():
            if v is None:
                continue
            if isinstance(v, str):
                items.append((rid, k, None, v))
            else:
                items.append((rid, k, float(v), None))

    trabajadores = []
    for p, semanas in cohorte:
        pid = uuid.uuid4()
        codigo = f'{PREFIJO}{p["idx"]:03d}'
        inscrito = datetime.combine(lunes0 - timedelta(days=3), datetime.min.time(), TZ)
        # `finalizado`: el seguimiento simulado terminó. No se marca
        # `detectado` porque no se crea derivación ni evento de detección:
        # estos datos existen solo para entrenar, no para la operación.
        trabajadores.append((pid, org_id, codigo, 'finalizado', inscrito))
        anotar(pid, 'estable', 1, inscrito,
               {**p['estable'], 'rol': p['rol'], 'modalidad': p['modalidad']})

        for s in semanas:
            lunes = lunes0 + timedelta(weeks=s['semana'])
            for d in s['dias']:
                cuando = datetime.combine(lunes + timedelta(days=d['dow']),
                                          datetime.min.time(), TZ) + timedelta(hours=19, minutes=int(np.random.default_rng(abs(hash((str(pid), s['semana'], d['dow']))) % 2**32).integers(0, 200)))
                anotar(pid, 'diario', 3, cuando,
                       {k: v for k, v in d.items() if k != 'dow'})
            viernes = datetime.combine(lunes + timedelta(days=4), datetime.min.time(), TZ) + timedelta(hours=17)
            anotar(pid, 'semanal', 2, viernes, s['semanal'])
            anotar(pid, 'olbi', 2, viernes + timedelta(minutes=6), s['olbi'])

    with cx.cursor() as cur:
        cur.executemany(
            "insert into trabajadores (id, organizacion_id, codigo_anonimo, estado, inscrito_en) "
            "values (%s, %s, %s, %s, %s)", trabajadores)
        cur.executemany(
            "insert into respuestas (id, trabajador_id, formulario_clave, formulario_version, "
            "iniciado_en, enviado_en) values (%s, %s, %s, %s, %s, %s)", respuestas)
        cur.executemany(
            "insert into respuestas_items (respuesta_id, item_clave, valor_num, valor_texto) "
            "values (%s, %s, %s, %s)", items)
    print(f'insertados {len(trabajadores)} trabajadores, {len(respuestas)} respuestas, '
          f'{len(items)} ítems en «{ORG}»')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--personas', type=int, default=N_PERSONAS)
    ap.add_argument('--semillaaleatoria', type=int, default=20260924, dest='semilla')
    ap.add_argument('--calibrar', action='store_true', help='solo imprime estadísticas, no toca la base')
    ap.add_argument('--cargar', action='store_true', help='reemplaza la cohorte SIM-* en la base')
    ap.add_argument('--limpiar', action='store_true', help='borra la cohorte SIM-* y sale')
    args = ap.parse_args()

    if args.limpiar:
        cx = conectar()
        n = limpiar(cx)
        cx.commit()
        print(f'borrados {n} trabajadores {PREFIJO}*')
        return

    rng = np.random.default_rng(args.semilla)
    cohorte = []
    for i in range(1, args.personas + 1):
        p = generar_persona(rng, i)
        cohorte.append((p, generar_seguimiento(p, rng)))

    est = calibracion(cohorte)
    print(f'Cohorte simulada — {args.personas} personas, semilla {args.semilla}\n')
    for k, v in est.items():
        ref = REFERENCIA.get(k)
        print(f'  {k:28s} {v}' + (f'   [referencia: {ref}]' if ref else ''))

    if args.cargar:
        cx = conectar()
        borrados = limpiar(cx)
        if borrados:
            print(f'\nreemplazando: borrados {borrados} trabajadores {PREFIJO}* anteriores')
        lunes0 = date.today() - timedelta(days=date.today().weekday()) - timedelta(weeks=SEMANAS + 1)
        cargar(cx, cohorte, lunes0)
        cx.commit()
    elif not args.calibrar:
        print('\n(nada escrito: --cargar para insertarla, --calibrar para solo ver esto)')


if __name__ == '__main__':
    main()
