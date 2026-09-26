"""Semilla de demostración multiempresa — SOLO entornos de prueba.

Deja la base con una foto creíble del estudio en marcha: cuatro empresas que
entraron en momentos distintos, con seis semanas de historia la más antigua y
dos la más nueva. Así se ve lo que el software hace con el tiempo: trayectorias
que suben, cohortes en distinto punto del calendario y el circuito de apoyo
ocupado en todas sus etapas a la vez.

  Nexa Software     22 personas · 6 semanas · carga normal
  Andes Data Labs   16 personas · 4 semanas · más carga (infraestructura, guardias)
  Marea Studio      13 personas · 6 semanas · mejor clima, casi sin detecciones
  Kuntur Fintech     7 personas · 2 semanas · POR DEBAJO del mínimo de reporte

La última existe a propósito: con menos de diez personas el panel de la empresa
no puede mostrar agregados (RN-008-04), y eso se enseña mejor con un caso que
explicándolo.

Los detectados se reparten por las etapas del circuito, de modo que el psicólogo
vea a la vez un caso sin contactar, una cita por confirmar, una confirmada, un
informe por aprobar y uno ya cerrado.

Las trayectorias las genera `modelo/simular.py`: los check-ins tienen la
estructura del diario v3 y el OLBI del viernes guarda una relación verosímil con
ellos. No son datos del estudio.

Uso:
    source ~/.zshrc
    modelo/exploracion/venv/bin/python supabase/semilla_demo_presentacion.py
    modelo/exploracion/venv/bin/python supabase/semilla_demo_presentacion.py --limpiar

`--limpiar` deja la base sin participantes ni empresas, lista para recibir datos
reales. Las cuentas de acceso, los psicólogos, los formularios y las versiones
del modelo no se tocan nunca.
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

import numpy as np
import psycopg

RAIZ = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / 'modelo'))
import simular as S  # noqa: E402

DSN = ("postgresql://postgres.tnllaabrtntlmobtnhfp:{clave}"
       "@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
TZ = timezone(timedelta(hours=-5))

# Cuenta que atiende las derivaciones y cuenta que administra la empresa mayor.
PSICOLOGO = 'test+psicologo@tesis.local'
ADMIN = 'test+admin@tesis.local'
# Participante con cuenta real: permite entrar a la app en vivo y encontrar a
# esa misma persona en el panel del investigador.
PARTICIPANTE_EN_VIVO = 'user.prueba2@gmail.com'

# Etapas del circuito, repartidas entre los detectados en este orden.
ETAPAS = ['informe_por_aprobar', 'cita_solicitada', 'sin_cita', 'cita_confirmada', 'completo']

EMPRESAS = [
    {'nombre': 'Nexa Software',   'prefijo': 'NX', 'n': 22, 'semanas': 6, 'sesgo':  0.00, 'det': 2, 'admin': True},
    {'nombre': 'Andes Data Labs', 'prefijo': 'AD', 'n': 16, 'semanas': 4, 'sesgo':  0.45, 'det': 3, 'admin': False},
    {'nombre': 'Marea Studio',    'prefijo': 'MS', 'n': 13, 'semanas': 6, 'sesgo': -0.40, 'det': 0, 'admin': False},
    {'nombre': 'Kuntur Fintech',  'prefijo': 'KF', 'n':  7, 'semanas': 2, 'sesgo':  0.15, 'det': 0, 'admin': False},
]

TRANSCRIPCION = """Psicólogo: Cuéntame cómo han sido estas últimas semanas.
Participante: Pesadas. Entramos en el cierre de una versión y me quedo hasta tarde casi todos los días.
Psicólogo: ¿Y cuando cierras la laptop, logras desconectar?
Participante: La verdad no. Me quedo dándole vueltas, y si entra una alerta de producción la reviso igual. La semana pasada me llamaron dos veces de madrugada.
Psicólogo: ¿Cómo está tu descanso?
Participante: Duermo unas cinco horas. Me levanto cansado incluso antes de empezar.
Psicólogo: ¿Has podido hablar de esta carga con tu líder?
Participante: Se lo comenté una vez. Me dijo que después del cierre bajaría el ritmo, pero el cierre se ha ido moviendo.
Psicólogo: ¿Qué cosas te ayudan cuando logras parar?
Participante: Salir a correr, y los fines de semana cuando de verdad me desconecto. Pero últimamente trabajo también el sábado.
Psicólogo: Te propongo dos cosas concretas para esta semana. Una hora fija de cierre, y hablar con tu líder de la rotación de guardias.
Participante: Lo de la hora fija lo puedo intentar. Lo de las guardias también, aunque me da algo de reparo.
Psicólogo: Lo vemos la próxima sesión y ajustamos."""

BORRADOR = {
    "temas_tratados": [
        "Carga sostenida por el cierre de una versión, con jornadas que se extienden más allá del horario habitual.",
        "Dificultad para desconectar al terminar el día y revisión de alertas fuera de horario.",
        "Reducción del tiempo de sueño, referido en torno a cinco horas.",
        "Conversación previa con el líder sobre la carga, sin cambios efectivos hasta ahora.",
    ],
    "situaciones_laborales_mencionadas": [
        "Cierre de versión que se ha desplazado en el tiempo.",
        "Dos llamadas de madrugada por alertas de producción en la última semana.",
        "Trabajo durante el fin de semana en las últimas semanas.",
    ],
    "recursos_de_apoyo_mencionados": [
        "Salir a correr.",
        "Los fines de semana en que logra desconectarse por completo.",
        "Disposición del líder a conversar, aunque sin resultado todavía.",
    ],
    "acuerdos_de_la_sesion": [
        "Fijar una hora de cierre de jornada durante la próxima semana.",
        "Plantear al líder la rotación de las guardias.",
        "Revisar ambos acuerdos en la siguiente sesión.",
    ],
    "citas_textuales_relevantes": [
        {"texto": "Me levanto cansado incluso antes de empezar.",
         "contexto": "Al describir su descanso durante el cierre de versión."},
        {"texto": "Me quedo dándole vueltas, y si entra una alerta de producción la reviso igual.",
         "contexto": "Al preguntarle si logra desconectar al terminar el día."},
    ],
    "nota_del_borrador": "",
}

deteccion_de: dict[str, tuple] = {}
# Filas acumuladas: se escriben en lotes al final. Insertar una por una son
# miles de viajes al servidor y el pooler termina cortando la conexión.
_respuestas: list = []
_items: list = []


def conectar():
    clave = os.environ.get('SUPABASE_DB_PASSWORD')
    if not clave:
        sys.exit('falta SUPABASE_DB_PASSWORD en el entorno (source ~/.zshrc)')
    cx = psycopg.connect(DSN.format(clave=clave))
    cx.prepare_threshold = None
    cx.execute('reset role')
    # Sembrar y limpiar son operaciones masivas; el límite de 8 s pensado para
    # las consultas de la app corta a mitad un borrado de miles de filas.
    cx.execute('set statement_timeout = 0')
    return cx


def limpiar(cx, borrar_empresas: bool) -> tuple[int, list]:
    """Borra todo lo que genera un participante.

    NO toca cuentas de acceso, psicólogos, formularios, versiones del modelo ni
    umbrales.

    Las empresas viejas no se borran aquí cuando se va a sembrar: un rol de
    administrador no puede quedarse sin empresa (`admin_pertenece_a_empresa`),
    así que primero se crean las nuevas, se reapunta al admin y recién entonces
    se retiran las anteriores. `borrar_empresas` es para el borrado total."""
    n = cx.execute("select count(*) from participantes").fetchone()[0]
    # Borrado por tabla completa, no por lista de identificadores: todas estas
    # tablas cuelgan de `participantes` y se van enteras. Filtrar por un arreglo
    # de miles de ids hace que el borrado tarde más que el propio sembrado.
    for tabla in ('resumenes_participante', 'informes', 'transcripciones',
                  'sesiones_consulta', 'citas', 'derivaciones',
                  'respuestas_items', 'respuestas', 'eventos',
                  'consentimientos', 'identidades', 'participantes'):
        cx.execute(f'delete from {tabla}')

    viejas = [r[0] for r in cx.execute("select id from organizaciones").fetchall()]
    cx.execute("delete from administradores")
    if borrar_empresas:
        # Un admin sin empresa viola el check, así que en el borrado total su
        # rol también se va: hay que volver a darlo de alta con la empresa nueva.
        cx.execute("delete from usuarios_rol where rol = 'admin'")
        cx.execute("delete from organizaciones")
        return n, []
    return n, viejas


def trayectorias(rng, n_total: int, n_detectados: int, semanas: int, sesgo: float):
    """Genera `n_total` personas, de las cuales `n_detectados` cruzan el umbral.

    El cruce tiene que caer en una semana ya cerrada. La semana en curso no
    tiene todavía su viernes, así que un cruce ahí no se llegaría a registrar y
    el circuito de apoyo quedaría colgando de una detección inexistente."""
    cerradas = semanas - 1   # la última semana está en curso
    sin, con = [], []
    i = 0
    while len(sin) + len(con) < n_total:
        i += 1
        if i > 12000:
            sys.exit('no se pudieron generar suficientes trayectorias')
        p = S.generar_persona(rng, i, sesgo)
        ss = S.generar_seguimiento(p, rng)[:semanas]
        # A los detectados se les exige historia previa: así la ficha muestra
        # una trayectoria que sube, no un cruce en la primera semana.
        cruza_a_tiempo = any(s['alto'] for s in ss[:cerradas]) and len(ss) >= min(3, semanas)
        if cruza_a_tiempo and len(con) < n_detectados:
            con.append((p, ss))
        elif not any(s['alto'] for s in ss) and len(ss) == semanas and len(sin) < n_total - n_detectados:
            sin.append((p, ss))
    return sin, con


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--limpiar', action='store_true')
    ap.add_argument('--semillaaleatoria', type=int, default=20260924, dest='semilla')
    args = ap.parse_args()

    cx = conectar()
    n_part, viejas = limpiar(cx, borrar_empresas=args.limpiar)
    if args.limpiar:
        cx.commit()
        print(f'base limpia: {n_part} participantes retirados, sin empresas.')
        print('Se conservan cuentas de acceso, psicólogos, formularios, versiones del')
        print('modelo y umbrales. El rol de administrador habrá que volver a asignarlo')
        print('cuando exista una empresa.')
        return
    if n_part or viejas:
        print(f'se retiraron {n_part} participantes y {len(viejas)} empresas anteriores\n')

    psi = cx.execute("""select p.id from psicologos p join auth.users u on u.id = p.auth_user_id
                        where u.email = %s""", (PSICOLOGO,)).fetchone()
    if not psi:
        sys.exit(f'no existe el psicólogo {PSICOLOGO}')
    psi = psi[0]
    admin_uid = cx.execute("select id from auth.users where email = %s", (ADMIN,)).fetchone()
    cuenta_viva = cx.execute("select id from auth.users where email = %s",
                             (PARTICIPANTE_EN_VIVO,)).fetchone()

    rng = np.random.default_rng(args.semilla)
    hoy = date.today()
    lunes_actual = hoy - timedelta(days=hoy.weekday())
    etapas = list(ETAPAS)
    todos = []

    for emp in EMPRESAS:
        org = cx.execute("insert into organizaciones (nombre) values (%s) returning id",
                         (emp['nombre'],)).fetchone()[0]
        if emp['admin'] and admin_uid:
            cx.execute("""insert into administradores (auth_user_id, organizacion_id, nombre, activo)
                          values (%s, %s, 'Admin Institucional', true)""", (admin_uid[0], org))
            cx.execute("update usuarios_rol set organizacion_id = %s where auth_user_id = %s",
                       (org, admin_uid[0]))

        sin, con = trayectorias(rng, emp['n'], emp['det'], emp['semanas'], emp['sesgo'])
        # Cada empresa entró al estudio hace `semanas` semanas.
        lunes0 = lunes_actual - timedelta(weeks=emp['semanas'] - 1)

        creados = []
        for k, (p, ss) in enumerate(sin + con, start=1):
            codigo = f"{emp['prefijo']}-{k:02d}"
            cruza = any(s['alto'] for s in ss)
            auth = cuenta_viva[0] if (emp['admin'] and k == 1 and cuenta_viva) else None
            pid = escribir_participante(cx, org, codigo, auth, lunes0, p, ss, cruza,
                                        en_vivo=auth is not None)
            creados.append({'pid': pid, 'codigo': codigo, 'cruza': cruza,
                            'empresa': emp['nombre'], 'lunes0': lunes0, 'semanas': emp['semanas'],
                            'etapa': None})

        for c in [x for x in creados if x['cruza']]:
            c['etapa'] = etapas.pop(0) if etapas else 'sin_cita'
            circuito(cx, c, psi, c['etapa'])

        todos += creados
        print(f"  {emp['nombre']:18s} {emp['n']:3d} personas · {emp['semanas']} semanas · "
              f"{sum(1 for c in creados if c['cruza'])} detectados")

    n_resp, n_items = volcar(cx)
    print(f'\n  {n_resp} respuestas y {n_items} ítems escritos.')
    # Ahora que el admin apunta a una empresa nueva, las viejas pueden irse.
    if viejas:
        cx.execute("delete from organizaciones where id = any(%s)", (viejas,))
    cx.commit()
    n_pred = predicciones(cx, todos)
    cx.commit()

    print(f"\n{len(todos)} participantes en {len(EMPRESAS)} empresas.")
    for c in todos:
        if c['etapa']:
            print(f"  {c['codigo']:7s} {c['empresa']:18s} detectado -> {c['etapa']}")
    if cuenta_viva:
        print(f"\n  {EMPRESAS[0]['prefijo']}-01 usa la cuenta {PARTICIPANTE_EN_VIVO}: se puede entrar en vivo.")
    print(f"  {n_pred} predicciones retrospectivas registradas.")
    print(f"  admin {ADMIN} -> {EMPRESAS[0]['nombre']}")


def escribir_participante(cx, org, codigo, auth_user_id, lunes0, persona, semanas, cruza,
                          en_vivo: bool = False) -> str:
    estado = 'detectado' if cruza else 'activo'
    # La inscripción es el lunes de la primera semana, no antes: si cayera en
    # un viernes previo, el panel contaría ese viernes como un OLBI omitido.
    inscrito = datetime.combine(lunes0, datetime.min.time(), TZ) + timedelta(hours=9)
    pid = cx.execute("""insert into participantes (organizacion_id, auth_user_id, codigo_anonimo, estado, inscrito_en)
                        values (%s, %s, %s, %s, %s) returning id""",
                     (org, auth_user_id, codigo, estado, inscrito)).fetchone()[0]

    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en) values (%s, 'inicio_seguimiento', %s)",
               (pid, inscrito))
    # Sin consentimiento la app manda a la pantalla de consentir y el panel lo
    # marca como pendiente (ESP-001).
    cx.execute("""insert into consentimientos (participante_id, version_texto, aceptado, registrado_en)
                  values (%s, 'v2-2026-09', true, %s)""", (pid, inscrito))
    insertar(cx, pid, 'estable', 1, inscrito,
             {**persona['estable'], 'rol': persona['rol'], 'modalidad': persona['modalidad']})

    ahora = datetime.now(TZ)
    # A quien presta su cuenta para la demostración se le deja el check-in de
    # hoy sin responder: es lo primero que se enseña en vivo, y con la
    # respuesta ya escrita la app dice «registrado» y no hay nada que mostrar.
    hoy = ahora.date()
    for s in semanas:
        lunes = lunes0 + timedelta(weeks=s['semana'])
        for d in s['dias']:
            cuando = datetime.combine(lunes + timedelta(days=d['dow']), datetime.min.time(), TZ) + timedelta(hours=19)
            # Nada con fecha futura: la semana en curso está a medias, igual
            # que en el estudio real. Si no, el panel marca a todo el mundo
            # como «sin viernes» por un OLBI que todavía no toca responder.
            if cuando > ahora:
                continue
            if en_vivo and cuando.date() == hoy:
                continue
            insertar(cx, pid, 'diario', 3, cuando, {k: v for k, v in d.items() if k != 'dow'})
        viernes = datetime.combine(lunes + timedelta(days=4), datetime.min.time(), TZ) + timedelta(hours=17)
        if viernes > ahora:
            continue
        insertar(cx, pid, 'semanal', 2, viernes, s['semanal'])
        insertar(cx, pid, 'olbi', 2, viernes + timedelta(minutes=6), s['olbi'])
        if s['alto']:
            detectado_en = viernes + timedelta(minutes=8)
            ev = cx.execute("""insert into eventos (participante_id, tipo, ocurrido_en, metadata)
                               values (%s, 'deteccion', %s, %s) returning id""",
                            (pid, detectado_en, psycopg.types.json.Jsonb({
                                'metodo': 'olbi_umbral',
                                'puntajes': {'agotamiento': float(s['agotamiento']),
                                             'desvinculacion': float(s['desvinculacion'])},
                                'umbrales': {'agotamiento': S.UMBRAL_AGOTAMIENTO,
                                             'desvinculacion': S.UMBRAL_DESVINCULACION}}))).fetchone()[0]
            deteccion_de[str(pid)] = (ev, detectado_en)
    return pid


def insertar(cx, pid, clave, version, cuando, valores: dict) -> None:
    """Acumula. El volcado real lo hace `volcar()`."""
    rid = uuid.uuid4()
    _respuestas.append((rid, pid, clave, version, cuando - timedelta(seconds=40), cuando))
    for k, v in valores.items():
        if v is None:
            continue
        _items.append((rid, k, float(v) if not isinstance(v, str) else None,
                       v if isinstance(v, str) else None))


def volcar(cx) -> tuple[int, int]:
    with cx.cursor() as cur:
        cur.executemany("""insert into respuestas (id, participante_id, formulario_clave, formulario_version, iniciado_en, enviado_en)
                           values (%s, %s, %s, %s, %s, %s)""", _respuestas)
        cur.executemany("""insert into respuestas_items (respuesta_id, item_clave, valor_num, valor_texto)
                           values (%s, %s, %s, %s)""", _items)
    n = (len(_respuestas), len(_items))
    _respuestas.clear(); _items.clear()
    return n


def circuito(cx, c, psi, etapa: str) -> None:
    pid = c['pid']
    evento_id, detectado_en = deteccion_de.get(str(pid), (None, datetime.now(TZ)))

    deriv = cx.execute("""insert into derivaciones (participante_id, psicologo_id, evento_deteccion_id, abierta_en, origen)
                          values (%s, %s, %s, %s, 'deteccion') returning id""",
                       (pid, psi, evento_id, detectado_en + timedelta(minutes=2))).fetchone()[0]
    cx.execute("""insert into eventos (participante_id, tipo, ocurrido_en, metadata)
                  values (%s, 'derivacion_psicologo', %s, %s)""",
               (pid, detectado_en + timedelta(minutes=2),
                psycopg.types.json.Jsonb({'derivacion_id': str(deriv)})))
    if etapa == 'sin_cita':
        return

    # Antes de escribirle hay que saber a quién: el psicólogo abre la identidad
    # y `obtener_identidad` lo deja anotado. Es la única forma de que existan
    # datos personales a la vista, y lo que llena la pantalla de Auditoría.
    # Solo desde `cita_solicitada`: quien sigue «sin cita» aún no ha contactado.
    cx.execute("""insert into eventos (participante_id, tipo, ocurrido_en, metadata)
                  values (%s, 'acceso_identidad', %s, %s)""",
               (pid, detectado_en + timedelta(hours=2),
                psycopg.types.json.Jsonb({'psicologo_id': str(psi), 'por': 'psicologo',
                                          'motivo': 'Obtener el correo para proponer la primera cita.'})))

    para = (detectado_en + timedelta(days=3)).replace(hour=16, minute=0, second=0, microsecond=0)
    estado_cita = 'solicitada' if etapa == 'cita_solicitada' else 'confirmada'
    cita = cx.execute("""insert into citas (participante_id, derivacion_id, psicologo_id, propuesta_para, motivo, estado, creada_en)
                         values (%s, %s, %s, %s, %s, %s, %s) returning id""",
                      (pid, deriv, psi, para,
                       'Quisiera hablar de la carga de estas semanas y de cómo estoy durmiendo.',
                       estado_cita, detectado_en + timedelta(hours=3))).fetchone()[0]
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'cita_solicitada', %s, %s)",
               (pid, detectado_en + timedelta(hours=3), psycopg.types.json.Jsonb({'cita_id': str(cita)})))
    if etapa in ('cita_solicitada', 'cita_confirmada'):
        return

    inicio, fin = para, para + timedelta(minutes=38)
    ses = cx.execute("""insert into sesiones_consulta (derivacion_id, consentimiento_participante, consentimiento_psicologo, sala_livekit, iniciada_en, finalizada_en)
                        values (%s, true, true, %s, %s, %s) returning id""",
                     (deriv, f'demo-{uuid.uuid4().hex[:12]}', inicio, fin)).fetchone()[0]
    # Los dos hitos que la app registra y de los que vive `circuito_apoyo`.
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'sesion_iniciada', %s, %s)",
               (pid, inicio, psycopg.types.json.Jsonb({'sesion_id': str(ses)})))
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'sesion_realizada', %s, %s)",
               (pid, fin, psycopg.types.json.Jsonb({'sesion_id': str(ses)})))
    cx.execute("update citas set estado = 'atendida' where id = %s", (cita,))

    tr = cx.execute("""insert into transcripciones (sesion_id, estado, texto, proveedor, creada_en, generada_en, borrar_despues_de, etapa)
                       values (%s, 'lista', %s, 'deepgram-nova-3', %s, %s, %s, 'informe_listo') returning id""",
                    (ses, TRANSCRIPCION, fin, fin + timedelta(minutes=2), fin + timedelta(days=30))).fetchone()[0]
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'transcripcion_lista', %s, %s)",
               (pid, fin + timedelta(minutes=2), psycopg.types.json.Jsonb({'sesion_id': str(ses)})))

    aprobado = etapa == 'completo'
    inf = cx.execute("""insert into informes (sesion_id, transcripcion_id, contenido_borrador, contenido_aprobado, estado, modelo, generado_en, aprobado_por, aprobado_en)
                        values (%s, %s, %s, %s, %s, 'claude-haiku-4-5-20251001', %s, %s, %s) returning id""",
                     (ses, tr, psycopg.types.json.Jsonb(BORRADOR),
                      psycopg.types.json.Jsonb(BORRADOR) if aprobado else None,
                      'aprobado' if aprobado else 'sin_revisar',
                      fin + timedelta(minutes=3),
                      psi if aprobado else None,
                      fin + timedelta(hours=2) if aprobado else None)).fetchone()[0]
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'informe_generado', %s, %s)",
               (pid, fin + timedelta(minutes=3), psycopg.types.json.Jsonb({'informe_id': str(inf)})))
    if aprobado:
        # El disparador `informes_evento_aprobado` escucha UPDATE; aquí el
        # informe nace ya aprobado, así que el hito se registra a mano.
        cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'informe_aprobado', %s, %s)",
                   (pid, fin + timedelta(hours=2),
                    psycopg.types.json.Jsonb({'informe_id': str(inf), 'sesion_id': str(ses)})))
        # Aprobar cierra el acompañamiento: el psicólogo deja de ver a la
        # persona (RF-006-06) y el circuito queda completo de punta a punta.
        cx.execute("update derivaciones set cerrada_en = %s where id = %s",
                   (fin + timedelta(hours=2, minutes=5), deriv))
        cx.execute("update participantes set estado = 'finalizado' where id = %s", (pid,))
        cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'salida_seguimiento', %s, %s)",
                   (pid, fin + timedelta(hours=2, minutes=5),
                    psycopg.types.json.Jsonb({'motivo': 'acompañamiento completado'})))


def predicciones(cx, todos: list) -> int:
    """Lo que la app habría registrado cada semana.

    `registrar_prediccion()` solo calcula sobre la semana en curso, así que aquí
    se reproduce su aritmética con la fecha de referencia de cada semana: mismos
    pesos, misma estandarización, misma sigmoide."""
    n = 0
    for tarea in ('nowcast', 'pronostico'):
        v = cx.execute("""select version, rasgos, medias, desviaciones, pesos, intercepto, umbral_decision
                          from modelo_versiones where tarea = %s and activa""", (tarea,)).fetchone()
        if not v:
            continue
        version, rasgos, medias, desv, pesos, intercepto, umbral = v
        for c in todos:
            for k in range(c['semanas']):
                ref = c['lunes0'] + timedelta(weeks=k, days=3 if tarea == 'nowcast' else 4)
                x = cx.execute("select rasgos_semana(%s, %s)", (c['pid'], ref)).fetchone()[0]
                if not x:
                    continue
                z = float(intercepto)
                for i, nombre in enumerate(rasgos):
                    z += float(pesos[i]) * (float(x[nombre]) - float(medias[i])) / float(desv[i])
                prob = round(1 / (1 + np.exp(-z)), 3)
                cuando = datetime.combine(ref, datetime.min.time(), TZ) + timedelta(hours=18, minutes=30)
                cx.execute("""insert into eventos (participante_id, tipo, ocurrido_en, metadata)
                              values (%s, 'prediccion_modelo', %s, %s)""",
                           (c['pid'], cuando, psycopg.types.json.Jsonb({
                               'version': version, 'tarea': tarea, 'dia': ref.isoformat(),
                               'n_dias': int(x['n_dias']), 'probabilidad': float(prob),
                               'senalado': bool(prob >= float(umbral)), 'demo': True})))
                n += 1
    return n


if __name__ == '__main__':
    main()
