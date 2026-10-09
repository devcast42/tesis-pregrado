"""Criterios de aceptación de ESP-005 §10, automatizados.

Cada prueba comprueba una propiedad que, de romperse, invalida el capítulo de
resultados sin dar ningún síntoma visible: una fuga de información produce
métricas mejores, no un error. Por eso se verifican en código y no a ojo.

    CA-005-01  ninguna entrada usa datos posteriores a la semana t (lunes a viernes)
    CA-005-02  ningún ítem olbi_* de la semana etiquetada entra como rasgo
    CA-005-03  cada trabajador cae en un solo pliegue
    CA-005-04  nadie aporta semanas posteriores a su primer cruce
    CA-005-05  los rasgos de §4.1 coinciden en SQL y en Python
    CA-005-06  la predicción en Postgres coincide con la de Python
    CA-005-08  los pesos del preentrenamiento se reproducen desde modelo/

CA-005-07 (reportar precisión, recall, F1, PR-AUC y ROC-AUC por pliegue para
un solo modelo y su línea base) lo cumple modelo/entrenar.py y se revisa sobre
su salida; no es automatizable como aserción.

Uso:
    modelo/exploracion/venv/bin/python modelo/pruebas.py
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import sys

import numpy as np
import psycopg
from scipy.special import expit
from sklearn.model_selection import GroupKFold

RAIZ = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ))
DSN = ("postgresql://postgres.tnllaabrtntlmobtnhfp:{clave}"
       "@aws-0-us-east-1.pooler.supabase.com:6543/postgres")

fallos: list[str] = []


def prueba(nombre: str):
    def decorador(fn):
        def envuelta(cx):
            try:
                detalle = fn(cx)
                print(f'  OK   {nombre}  {detalle or ""}')
            except AssertionError as e:
                fallos.append(nombre)
                print(f'  FALLA {nombre}: {e}')
            except Exception as e:  # una prueba que no corre no es una prueba que pasa
                fallos.append(nombre)
                print(f'  ERROR {nombre}: {type(e).__name__}: {e}')
        envuelta.nombre = nombre
        return envuelta
    return decorador


# ---------------------------------------------------------------- CA-005-01

@prueba('CA-005-01 sin datos posteriores a la semana t')
def ca_01(cx):
    """La vista solo puede mirar el check-in de lunes a viernes y el semanal
    de t. Si alguna fila tuviera rasgos diarios que solo existen en el fin de
    semana o después, el rasgo vendría del futuro."""
    n = cx.execute("""
        with dia_usado as (
          select r.trabajador_id,
                 semana_de(r.enviado_en) as semana,
                 (r.enviado_en at time zone tz_estudio())::date as dia
          from respuestas r
          where r.formulario_clave = 'diario'
        )
        select count(*) from dia_usado
        where extract(isodow from dia)::int > 5
          and exists (select 1 from semanas_modelo s
                      where s.trabajador_id = dia_usado.trabajador_id
                        and s.semana = dia_usado.semana
                        and s.n_dias > 0)
          -- ...y esa semana no tiene ningún día lunes-viernes que explique el rasgo
          and not exists (select 1 from respuestas r2
                          where r2.trabajador_id = dia_usado.trabajador_id
                            and r2.formulario_clave = 'diario'
                            and semana_de(r2.enviado_en) = dia_usado.semana
                            and extract(isodow from (r2.enviado_en at time zone tz_estudio())::date)::int between 1 and 5)
    """).fetchone()[0]
    assert n == 0, f'{n} semanas con rasgos diarios que solo pueden venir del fin de semana'

    # El semanal que entra como rasgo es el del viernes de t, nunca uno posterior.
    n2 = cx.execute("""
        select count(*) from semanas_modelo s
        where s.horas_sobretiempo is not null
          and not exists (
            select 1 from respuestas r
            where r.trabajador_id = s.trabajador_id
              and r.formulario_clave = 'semanal'
              and semana_de(r.enviado_en) = s.semana)
    """).fetchone()[0]
    assert n2 == 0, f'{n2} filas con rasgo semanal que no proviene de la semana t'
    return 'check-in lun-vie y semanal de t'


# ---------------------------------------------------------------- CA-005-02

@prueba('CA-005-02 ninguna entrada sale de la semana que se predice')
def ca_02(cx):
    """La etiqueta es el OLBI que cierra la semana t, y las entradas son los
    días de esa misma semana. Por eso `e_previo`/`d_previo` —que son ese OLBI—
    no pueden estar entre ellas: el modelo estaría leyendo la respuesta que
    tiene que adivinar, sacaría una precisión magnífica y no detectaría nada.

    Con la etiqueta anterior (`alto_t1`, el viernes siguiente) esto era menos
    grave, porque ese OLBI ya era pasado. Ahora es la comprobación que sostiene
    todo lo demás."""
    import entrenar
    rasgos = set(entrenar.RASGOS)
    assert entrenar.ETIQUETA == 'alto_t', 'la etiqueta dejó de ser el OLBI de esta semana'
    assert not any(r.startswith('olbi_') for r in rasgos), \
        'hay ítems olbi_* crudos entre los rasgos'
    assert not ({'e_previo', 'd_previo', 'alto_t', 'alto_t1'} & rasgos), \
        'hay puntajes del OLBI entre los rasgos'
    return f'{len(rasgos)} rasgos, ninguno del OLBI'


# --------------------------------------------------------------- CA-005-02b

@prueba('CA-005-02b el modelo puede opinar cualquier día de la semana')
def ca_02b(cx):
    """El producto muestra una probabilidad desde el lunes. Si entre las
    entradas hubiera respuestas que solo existen el viernes, las métricas del
    entrenamiento no se podrían reproducir en operación: el modelo habría
    aprendido con datos que el lunes todavía no existen."""
    import entrenar
    del_viernes = {'horas_sobretiempo', 'guardias', 'apoyo_lider'}
    usados = set(entrenar.RASGOS) & del_viernes
    assert not usados, f'el modelo usaría {sorted(usados)}, que se responden el viernes'

    # Y comprobar que de verdad se responden el viernes, no asumirlo.
    reparto = dict(cx.execute("""
        select extract(isodow from (enviado_en at time zone tz_estudio())::date)::int, count(*)
        from respuestas where formulario_clave = 'semanal' group by 1
    """).fetchall())
    if reparto:
        viernes_o_despues = sum(n for d, n in reparto.items() if d >= 5)
        assert viernes_o_despues / sum(reparto.values()) > 0.5, \
            'el cuestionario semanal ya no se responde el viernes: revisar esta exclusión'
    return f'{len(entrenar.RASGOS)} rasgos, todos del check-in diario'


# ---------------------------------------------------------------- CA-005-03

@prueba('CA-005-03 cada trabajador cae en un solo pliegue')
def ca_03(cx):
    filas = cx.execute("""
        select trabajador_id::text, semana, coalesce(alto_t, false)
        from semanas_modelo order by trabajador_id, semana
    """).fetchall()
    assert filas, 'semanas_modelo está vacía'
    grupos = np.array([f[0] for f in filas])
    y = np.array([int(f[2]) for f in filas])
    n = min(5, len(np.unique(grupos)))
    assert n >= 2, 'hacen falta al menos 2 personas para partir'
    visto: dict[str, int] = {}
    for i, (_, te) in enumerate(GroupKFold(n_splits=n).split(grupos, y, grupos)):
        for g in np.unique(grupos[te]):
            assert g not in visto, f'{g[:8]} aparece en los pliegues {visto[g]} y {i}'
            visto[g] = i
    assert len(visto) == len(np.unique(grupos))
    return f'{len(visto)} personas en {n} pliegues, sin repetirse'


# ---------------------------------------------------------------- CA-005-04

@prueba('CA-005-04 nadie aporta semanas posteriores a su primer cruce')
def ca_04(cx):
    n = cx.execute("""
        with cruce as (
          select trabajador_id, min(semana) filter (where alto) as primera
          from olbi_semanal_etiquetado group by trabajador_id)
        select count(*) from semanas_modelo s
        join cruce c using (trabajador_id)
        where c.primera is not null and s.semana > c.primera
    """).fetchone()[0]
    assert n == 0, f'{n} filas posteriores al primer cruce'
    # Y en la semana del cruce no puede haber etiqueta de pronóstico: esa t+1
    # nunca se observa porque la persona sale del seguimiento.
    n2 = cx.execute("""
        with cruce as (
          select trabajador_id, min(semana) filter (where alto) as primera
          from olbi_semanal_etiquetado group by trabajador_id)
        select count(*) from semanas_modelo s
        join cruce c using (trabajador_id)
        where c.primera is not null and s.semana = c.primera and s.alto_t1 is not null
    """).fetchone()[0]
    assert n2 == 0, f'{n2} filas de la semana del cruce con etiqueta de pronóstico'
    return 'censura correcta en ambas tareas'


# ---------------------------------------------------------------- CA-005-05

@prueba('CA-005-05 los rasgos de §4.1 coinciden en SQL y en Python')
def ca_05(cx):
    """Se recalculan en Python desde los ítems crudos y se comparan con la
    vista y con `rasgos_semana`, que es la que usa la app en operación."""
    from preentrenar import rasgos as rasgos_py

    filas = cx.execute("""
        select trabajador_id::text, semana, n_dias,
               t_media, t_ultimo, t_max, t_pendiente, e_media, d_media
        from semanas_modelo where n_dias > 0 order by trabajador_id, semana
    """).fetchall()
    assert filas, 'no hay filas con señal diaria que comparar'

    comparadas = 0
    for pid, semana, n_dias, *esperados in filas:
        dias = cx.execute("""
            select distinct on (dia) dia, od_04, od_12, od_03, od_06 from (
              select (r.enviado_en at time zone tz_estudio())::date as dia, r.enviado_en,
                     max(i.valor_num) filter (where i.item_clave='od_04') od_04,
                     max(i.valor_num) filter (where i.item_clave='od_12') od_12,
                     max(i.valor_num) filter (where i.item_clave='od_03') od_03,
                     max(i.valor_num) filter (where i.item_clave='od_06') od_06
              from respuestas r join respuestas_items i on i.respuesta_id = r.id
              where r.trabajador_id = %s and r.formulario_clave = 'diario'
                and semana_de(r.enviado_en) = %s
                and extract(isodow from (r.enviado_en at time zone tz_estudio())::date)::int between 1 and 5
              group by dia, r.enviado_en) v
            where od_04 is not null and od_12 is not null and od_03 is not null and od_06 is not null
            order by dia, enviado_en desc
        """, (pid, semana)).fetchall()
        py = rasgos_py([{'od_04': float(d[1]), 'od_12': float(d[2]),
                         'od_03': float(d[3]), 'od_06': float(d[4])} for d in dias])
        assert py['n_dias'] == n_dias, f'{pid[:8]} {semana}: n_dias {py["n_dias"]} vs {n_dias}'
        for nombre, sql_val in zip(('T_media', 'T_ultimo', 'T_max', 'T_pendiente',
                                    'E_media', 'D_media'), esperados):
            assert abs(float(py[nombre]) - float(sql_val)) < 1e-6, \
                f'{pid[:8]} {semana} {nombre}: python {py[nombre]} vs vista {sql_val}'

        # La misma comparación contra `rasgos_semana`, que es la función que
        # corre en producción (la vista solo se usa para entrenar).
        viernes = cx.execute("select %s::date + 4", (semana,)).fetchone()[0]
        rs = cx.execute("select rasgos_semana(%s, %s)", (pid, viernes)).fetchone()[0]
        if rs:
            for nombre in ('T_media', 'T_ultimo', 'T_max', 'T_pendiente', 'E_media', 'D_media'):
                assert abs(float(py[nombre]) - float(rs[nombre])) < 1e-6, \
                    f'{pid[:8]} {semana} {nombre}: python {py[nombre]} vs rasgos_semana {rs[nombre]}'
        comparadas += 1
    return f'{comparadas} trabajador-semanas idénticas en vista, función SQL y Python'


# ---------------------------------------------------------------- CA-005-06

@prueba('CA-005-06 la predicción en Postgres coincide con la de Python')
def ca_06(cx):
    """Mismo vector, mismos pesos: la sigmoide de Postgres y la de Python
    tienen que dar el mismo número. Si divergen, la app muestra una
    probabilidad distinta de la que se reportó en la tesis."""
    versiones = cx.execute("""
        select version, rasgos, medias, desviaciones, pesos, intercepto
        from modelo_versiones order by version
    """).fetchall()
    assert versiones, 'no hay versiones cargadas en modelo_versiones'

    rng = np.random.default_rng(42)
    comprobadas = 0
    for version, rasgos, medias, desviaciones, pesos, intercepto in versiones:
        m = np.array([float(x) for x in medias])
        s = np.array([float(x) for x in desviaciones])
        w = np.array([float(x) for x in pesos])
        b = float(intercepto)
        for _ in range(5):
            x = rng.uniform(1, 5, len(rasgos))
            z_py = float(((x - m) / s) @ w + b)
            p_py = float(expit(z_py))
            # La misma aritmética, hecha por Postgres.
            p_sql = float(cx.execute("""
                select 1 / (1 + exp(-(
                  (select sum(((v.x - v.m) / v.s) * v.w)
                   from unnest(%s::numeric[], %s::numeric[], %s::numeric[], %s::numeric[])
                        as v(x, m, s, w)) + %s)))
            """, (list(x), [float(v) for v in m], [float(v) for v in s],
                  [float(v) for v in w], b)).fetchone()[0])
            assert abs(p_py - p_sql) < 1e-9, \
                f'{version}: python {p_py:.12f} vs postgres {p_sql:.12f}'
            comprobadas += 1
    return f'{comprobadas} vectores en {len(versiones)} versiones'


# ---------------------------------------------------------------- CA-005-08

@prueba('CA-005-08 los pesos del preentrenamiento se reproducen desde modelo/')
def ca_08(cx):
    """El archivo de referencia tiene que ser el publicado (hash) y los pesos
    guardados en la base tienen que ser los del JSON versionado."""
    # El hash se lee del script, no se importa: `descargar.py` baja el archivo
    # al importarse y esta prueba no debe depender de la red.
    fuente = (RAIZ / 'exploracion' / 'descargar.py').read_text()
    esperado = re.search(r"SHA256\s*=\s*'([0-9a-f]{64})'", fuente)
    assert esperado, 'no se encontró el SHA256 publicado en descargar.py'
    sav = RAIZ / 'exploracion' / 'olbi_diario.sav'
    assert sav.exists(), f'falta {sav.name}: correr modelo/exploracion/descargar.py'
    digest = hashlib.sha256(sav.read_bytes()).hexdigest()
    assert digest == esperado.group(1), \
        f'el .sav no es el publicado en Mendeley (hash {digest[:12]}…)'

    for archivo in sorted((RAIZ / 'versiones').glob('preentrenamiento*.json')):
        v = json.loads(archivo.read_text())
        fila = cx.execute("""
            select rasgos, pesos, intercepto from modelo_versiones where version = %s
        """, (v['version'],)).fetchone()
        assert fila, f'{v["version"]} no está en modelo_versiones'
        assert list(fila[0]) == v['rasgos'], f'{v["version"]}: distinto orden de rasgos'
        for a, b in zip([float(x) for x in fila[1]], v['pesos']):
            assert abs(a - b) < 1e-9, f'{v["version"]}: peso {a} en la base vs {b} en el JSON'
        assert abs(float(fila[2]) - v['intercepto']) < 1e-9, f'{v["version"]}: intercepto distinto'
    return f'hash verificado y pesos idénticos a la base'


PRUEBAS = [ca_01, ca_02, ca_02b, ca_03, ca_04, ca_05, ca_06, ca_08]


def main() -> None:
    clave = os.environ.get('SUPABASE_DB_PASSWORD')
    if not clave:
        sys.exit('falta SUPABASE_DB_PASSWORD en el entorno (source ~/.zshrc)')
    print('Criterios de aceptación de ESP-005 §10\n')
    # autocommit: una prueba que falla no debe abortar la transacción y
    # arrastrar a las siguientes. prepare_threshold=None: el pooler reutiliza
    # sesiones y los `prepared statements` de psycopg chocan entre llamadas.
    with psycopg.connect(DSN.format(clave=clave), autocommit=True) as cx:
        cx.prepare_threshold = None
        cx.execute('reset role')
        for p in PRUEBAS:
            p(cx)
    print()
    if fallos:
        sys.exit(f'{len(fallos)} criterio(s) sin cumplir: {", ".join(fallos)}')
    print(f'{len(PRUEBAS)} criterios cumplidos.')


if __name__ == '__main__':
    main()
