"""Entrenamiento con datos propios — ESP-005 §5.2 pasos 3-4 y §7.

Lee la vista `semanas_modelo` (una fila por participante-semana, ESP-005 §8),
entrena las cuatro versiones que el capítulo de resultados tiene que comparar
y las evalúa con GroupKFold por persona.

    A    rasgos §4.1 + §4.2 sin el OLBI previo, partiendo de los pesos
         preentrenados w0 en los rasgos compartidos (ESP-005 §4.3)
    B    A + e_previo/d_previo (solo pronóstico): la versión operativa fuerte
    A0   igual que A pero desde cero: el control del experimento de §5
    B0   igual que B pero desde cero

Y tres líneas base (§7.4): clase mayoritaria, «igual que el viernes pasado»
(solo pronóstico) y el propio modelo preentrenado sin reajustar.

El preentrenamiento entra como regularización L2 *hacia w0* en los rasgos
compartidos y hacia cero en los propios, con el intercepto libre (§5.2 paso 3).
La fuerza hacia w0 se elige en validación y se reporta (§12 decisión 5).

Uso:
    modelo/exploracion/venv/bin/python modelo/entrenar.py               # ensayo
    modelo/exploracion/venv/bin/python modelo/entrenar.py --publicar    # + migración

Requiere SUPABASE_DB_PASSWORD en el entorno (`source ~/.zshrc`).
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys

import numpy as np
import pandas as pd
import psycopg
from scipy.optimize import minimize
from scipy.special import expit
from sklearn.metrics import (average_precision_score, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import GroupKFold

DSN = ("postgresql://postgres.tnllaabrtntlmobtnhfp:{clave}"
       "@aws-0-us-east-1.pooler.supabase.com:6543/postgres")

RAIZ = pathlib.Path(__file__).resolve().parent

# ESP-005 §4.1 — los rasgos que comparten preentrenamiento y operación. El
# orden importa: es el de `pesos` en modelo_versiones y en los JSON de w0.
COMPARTIDOS = ['t_media', 't_ultimo', 't_max', 't_pendiente', 'e_media', 'd_media', 'n_dias']
# Nombre del mismo rasgo en el preentrenamiento (modelo/versiones/*.json).
EN_W0 = {'t_media': 'T_media', 't_ultimo': 'T_ultimo', 't_max': 'T_max',
         't_pendiente': 'T_pendiente', 'e_media': 'E_media', 'd_media': 'D_media',
         'n_dias': 'n_dias'}

# ESP-005 §4.2 — rasgos propios, sin equivalente en el estudio de referencia.
PROPIOS = [
    'horas_media', 'horas_max', 'sueno_media', 'sueno_min', 'horas_fin_de_semana',
    'horas_sobretiempo', 'guardias', 'apoyo_lider',
    'edad', 'antiguedad_empresa', 'antiguedad_sector', 'tamano_equipo',
    'personas_a_cargo', 'minutos_traslado',
    'rol_desarrollo', 'rol_qa', 'rol_datos', 'rol_infraestructura',
    'rol_soporte', 'rol_diseno', 'rol_gestion', 'rol_otro',
    'modalidad_remoto', 'modalidad_hibrido', 'modalidad_presencial',
]
# Solo pronóstico: el OLBI del viernes de t, que en esa tarea ya es pasado.
OLBI_PREVIO = ['e_previo', 'd_previo']

TAREAS = {
    'nowcast':    {'etiqueta': 'alto_t',  'w0': 'preentrenamiento-v1'},
    'pronostico': {'etiqueta': 'alto_t1', 'w0': 'preentrenamiento-pronostico-v1'},
}

# Fuerzas de regularización a probar hacia w0 (§12 decisión 5). Grande =
# confiar en el dominio de referencia; pequeña = dejar que mande el dato propio.
REJILLA_LAMBDA = [0.1, 0.3, 1.0, 3.0, 10.0]
LAMBDA_PROPIOS = 1.0
PLIEGUES = 5
# Un falso negativo es alguien con burnout al que no se llama; un falso
# positivo, una conversación de más. El umbral se elige maximizando F-beta
# con beta = 2, que pesa el recall cuatro veces más que la precisión (§7.2).
BETA = 2.0


# --------------------------------------------------------------------- datos

def cargar(incluir_demo: bool) -> pd.DataFrame:
    clave = os.environ.get('SUPABASE_DB_PASSWORD')
    if not clave:
        sys.exit('falta SUPABASE_DB_PASSWORD en el entorno (source ~/.zshrc)')
    with psycopg.connect(DSN.format(clave=clave)) as cx:
        cx.execute('reset role')
        filtro = '' if incluir_demo else "where p.codigo_anonimo not like 'DEMO-%'"
        cur = cx.execute(f"""
            select s.*, p.codigo_anonimo
            from semanas_modelo s
            join participantes p on p.id = s.participante_id
            {filtro}
            order by s.participante_id, s.semana
        """)
        filas = cur.fetchall()
        columnas = [d.name for d in cur.description]
    D = pd.DataFrame(filas, columns=columnas)
    for c in D.columns:
        if c not in ('participante_id', 'semana', 'codigo_anonimo'):
            D[c] = pd.to_numeric(D[c], errors='coerce')
    return D


def w0_de(version: str) -> dict[str, float] | None:
    """Pesos y estandarización del preentrenamiento, por nombre de rasgo."""
    ruta = RAIZ / 'versiones' / f'{version}.json'
    if not ruta.exists():
        return None
    v = json.loads(ruta.read_text())
    return {
        'pesos': dict(zip(v['rasgos'], v['pesos'])),
        'medias': dict(zip(v['rasgos'], v['medias'])),
        'desviaciones': dict(zip(v['rasgos'], v['desviaciones'])),
        'intercepto': v['intercepto'],
    }


def matriz(D: pd.DataFrame, rasgos: list[str], w0: dict | None,
           stats: dict | None = None) -> tuple[np.ndarray, dict]:
    """Estandariza. Los rasgos compartidos usan la escala del preentrenamiento
    (si no, los pesos w0 no significan lo mismo); los propios, la de la muestra.

    `stats` se calcula en el pliegue de entrenamiento y se aplica al de prueba:
    estandarizar con la muestra completa filtraría información entre pliegues."""
    if stats is None:
        stats = {}
        for r in rasgos:
            compartido = w0 is not None and r in COMPARTIDOS
            if compartido:
                mu = w0['medias'][EN_W0[r]]
                sd = w0['desviaciones'][EN_W0[r]]
            else:
                mu = float(D[r].mean())
                sd = float(D[r].std(ddof=0)) or 1.0
            stats[r] = (mu, sd if sd else 1.0)
    X = np.column_stack([(D[r].to_numpy(float) - stats[r][0]) / stats[r][1] for r in rasgos])
    return X, stats


# ------------------------------------------------------------------ ajuste

def ajustar(X: np.ndarray, y: np.ndarray, ancla: np.ndarray, lam: np.ndarray,
            peso: np.ndarray) -> tuple[np.ndarray, float]:
    """Logística con penalización L2 hacia `ancla` (cero para los rasgos
    propios, w0 para los compartidos). El intercepto no se penaliza."""
    n, k = X.shape

    def objetivo(theta):
        w, b = theta[:k], theta[k]
        z = X @ w + b
        # logloss estable: log(1+e^z) - y·z
        perdida = np.sum(peso * (np.logaddexp(0.0, z) - y * z)) / peso.sum()
        dif = w - ancla
        reg = 0.5 * float(lam @ (dif ** 2))
        p = expit(z)
        g = (peso * (p - y)) / peso.sum()
        return perdida + reg, np.concatenate([X.T @ g + lam * dif, [g.sum()]])

    r = minimize(objetivo, np.concatenate([ancla, [0.0]]), jac=True, method='L-BFGS-B')
    return r.x[:k], float(r.x[k])


def pesos_balanceados(y: np.ndarray) -> np.ndarray:
    """`class_weight='balanced'` (§7.3): cada clase pesa lo mismo en total."""
    peso = np.ones(len(y), float)
    for clase in (0, 1):
        sel = y == clase
        if sel.sum():
            peso[sel] = len(y) / (2.0 * sel.sum())
    return peso


def umbral_por_recall(y: np.ndarray, p: np.ndarray) -> float:
    """Umbral que maximiza F-beta (beta=2) en el pliegue de entrenamiento."""
    mejor, mejor_u = -1.0, 0.5
    for u in np.unique(np.round(p, 3)):
        yh = (p >= u).astype(int)
        vp = int(((yh == 1) & (y == 1)).sum())
        if vp == 0:
            continue
        prec = vp / max(int((yh == 1).sum()), 1)
        rec = vp / max(int((y == 1).sum()), 1)
        f = (1 + BETA ** 2) * prec * rec / ((BETA ** 2 * prec) + rec) if (prec + rec) else 0
        if f > mejor:
            mejor, mejor_u = f, float(u)
    return mejor_u


# --------------------------------------------------------------- evaluación

def metricas(y: np.ndarray, p: np.ndarray, u: float) -> dict:
    yh = (p >= u).astype(int)
    hay_dos = len(np.unique(y)) == 2
    return {
        'precision': round(float(precision_score(y, yh, zero_division=0)), 3),
        'recall': round(float(recall_score(y, yh, zero_division=0)), 3),
        'f1': round(float(f1_score(y, yh, zero_division=0)), 3),
        'pr_auc': round(float(average_precision_score(y, p)), 3) if hay_dos else None,
        'roc_auc': round(float(roc_auc_score(y, p)), 3) if hay_dos else None,
    }


def resumen(por_pliegue: list[dict]) -> dict:
    """Media ± desviación por métrica (§7.1). Se reportan ambas."""
    out = {}
    for m in ('precision', 'recall', 'f1', 'pr_auc', 'roc_auc'):
        vals = [f[m] for f in por_pliegue if f.get(m) is not None]
        out[m] = {'media': round(float(np.mean(vals)), 3),
                  'de': round(float(np.std(vals)), 3),
                  'pliegues': len(vals)} if vals else None
    return out


def validar(D: pd.DataFrame, rasgos: list[str], y: np.ndarray, grupos: np.ndarray,
            w0: dict | None, lam_compartidos: float) -> tuple[dict, np.ndarray]:
    """GroupKFold por participante (§7.1, CA-005-03). Ninguna persona cae en
    dos pliegues, y la estandarización se aprende solo con el entrenamiento."""
    n_pliegues = min(PLIEGUES, len(np.unique(grupos)))
    if n_pliegues < 2:
        return {}, np.full(len(y), np.nan)
    ancla_base = np.array([
        (w0['pesos'][EN_W0[r]] if (w0 and r in COMPARTIDOS) else 0.0) for r in rasgos
    ])
    lam = np.array([
        (lam_compartidos if (w0 and r in COMPARTIDOS) else LAMBDA_PROPIOS) for r in rasgos
    ])
    p = np.full(len(y), np.nan)
    por_pliegue = []
    for tr, te in GroupKFold(n_splits=n_pliegues).split(D, y, grupos):
        Xtr, stats = matriz(D.iloc[tr], rasgos, w0)
        Xte, _ = matriz(D.iloc[te], rasgos, w0, stats)
        w, b = ajustar(Xtr, y[tr], ancla_base, lam, pesos_balanceados(y[tr]))
        u = umbral_por_recall(y[tr], expit(Xtr @ w + b))
        p[te] = expit(Xte @ w + b)
        if len(np.unique(y[te])):
            por_pliegue.append(metricas(y[te], p[te], u))
    return {'por_pliegue': por_pliegue, 'resumen': resumen(por_pliegue)}, p


def lineas_base(D: pd.DataFrame, y: np.ndarray, tarea: str) -> dict:
    """§7.4. La que importa es «igual que el viernes pasado»: lo que ya sabe
    el OLBI solo, sin ninguna señal diaria."""
    base = {'clase_mayoritaria': metricas(y, np.full(len(y), float(y.mean())), 0.5)}
    if tarea == 'pronostico' and 'e_previo' in D:
        # El viernes pasado ya estaba alto -> se predice alto la semana que viene.
        umbrales = D[['e_previo', 'd_previo']].dropna()
        if len(umbrales):
            u_ag, u_dv = umbral_olbi()
            pred = ((D['e_previo'] >= u_ag) | (D['d_previo'] >= u_dv)).astype(float).to_numpy()
            base['igual_que_el_viernes_pasado'] = metricas(y, pred, 0.5)
    return base


def umbral_olbi() -> tuple[float, float]:
    clave = os.environ['SUPABASE_DB_PASSWORD']
    with psycopg.connect(DSN.format(clave=clave)) as cx:
        cx.execute('reset role')
        r = cx.execute("""select (definicion->'umbrales'->>'agotamiento')::numeric,
                                 (definicion->'umbrales'->>'desvinculacion')::numeric
                          from formularios where clave='olbi' order by version desc limit 1""").fetchone()
    return float(r[0]), float(r[1])


# ------------------------------------------------------------------ informe

def entrenar_tarea(D: pd.DataFrame, tarea: str) -> dict:
    cfg = TAREAS[tarea]
    d = D.dropna(subset=[cfg['etiqueta']]).copy()
    # Sin señal diaria no hay fila que el modelo pueda puntuar.
    d = d[d['n_dias'] > 0]
    if d.empty:
        return {'tarea': tarea, 'error': 'sin filas con etiqueta y señal diaria'}
    for r in COMPARTIDOS + PROPIOS + OLBI_PREVIO:
        if r in d:
            d[r] = d[r].fillna(d[r].median() if d[r].notna().any() else 0.0)

    y = d[cfg['etiqueta']].to_numpy(int)
    grupos = d['participante_id'].astype(str).to_numpy()
    w0 = w0_de(cfg['w0'])

    variantes = {'A': COMPARTIDOS + PROPIOS}
    if tarea == 'pronostico':
        variantes['B'] = COMPARTIDOS + PROPIOS + OLBI_PREVIO

    salida = {
        'tarea': tarea,
        'n_filas': int(len(d)),
        'n_personas': int(len(np.unique(grupos))),
        'positivos': round(float(y.mean()), 3),
        'lambda_probadas': REJILLA_LAMBDA,
        'lineas_base': lineas_base(d, y, tarea),
        'versiones': {},
    }
    if len(np.unique(y)) < 2:
        salida['error'] = 'una sola clase en la etiqueta: no hay nada que aprender'
        return salida

    for nombre, rasgos in variantes.items():
        # Con preentrenamiento: se elige la fuerza hacia w0 en validación.
        mejor = None
        if w0:
            for lam in REJILLA_LAMBDA:
                m, _ = validar(d, rasgos, y, grupos, w0, lam)
                if not m:
                    continue
                r = (m['resumen'].get('pr_auc') or {}).get('media') or 0
                if mejor is None or r > mejor[1]:
                    mejor = (lam, r, m)
        if mejor:
            salida['versiones'][nombre] = {'lambda_hacia_w0': mejor[0], **mejor[2]}
        # Sin preentrenamiento (A0 / B0): el control.
        m0, _ = validar(d, rasgos, y, grupos, None, 0.0)
        if m0:
            salida['versiones'][f'{nombre}0'] = {'lambda_hacia_w0': None, **m0}
    return salida


def imprimir(res: dict) -> None:
    print(f"\n=== {res['tarea'].upper()} ===")
    if 'error' in res:
        print('  ', res['error'])
    print(f"  filas: {res.get('n_filas')}  personas: {res.get('n_personas')}  "
          f"positivos: {res.get('positivos')}")
    for nombre, b in res.get('lineas_base', {}).items():
        print(f"  base {nombre:28s} recall {b['recall']:.2f}  f1 {b['f1']:.2f}")
    for nombre, v in res.get('versiones', {}).items():
        r = v['resumen']
        def m(k):
            return f"{r[k]['media']:.2f}±{r[k]['de']:.2f}" if r.get(k) else "  —  "
        lam = v['lambda_hacia_w0']
        print(f"  {nombre:3s} lambda={str(lam):5s}  recall {m('recall')}  f1 {m('f1')}  "
              f"pr_auc {m('pr_auc')}  roc_auc {m('roc_auc')}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--incluir-demo', action='store_true',
                    help='incluye los participantes DEMO-* de la semilla de demostración. '
                         'Solo para probar la mecánica: sus datos son sintéticos.')
    ap.add_argument('--publicar', action='store_true',
                    help='escribe la migración que carga la versión en modelo_versiones')
    args = ap.parse_args()

    D = cargar(args.incluir_demo)
    sinteticas = int(D['codigo_anonimo'].str.startswith('DEMO-').sum()) if len(D) else 0
    print(f"semanas_modelo: {len(D)} filas, {D['participante_id'].nunique()} personas"
          + (f"  ({sinteticas} filas de la semilla de demostración)" if sinteticas else ""))

    resultados = {t: entrenar_tarea(D, t) for t in TAREAS}
    for r in resultados.values():
        imprimir(r)

    destino = RAIZ / 'resultados'
    destino.mkdir(exist_ok=True)
    informe = destino / ('ensayo-con-semilla-demo.json' if args.incluir_demo else 'datos-propios.json')
    informe.write_text(json.dumps(resultados, indent=2, ensure_ascii=False) + '\n')
    print(f'\nresultados en {informe.relative_to(RAIZ.parent)}')
    if args.incluir_demo:
        print('AVISO: estos números salen de la semilla de demostración (datos sintéticos).\n'
              '       No son resultados del estudio y no pueden ir en la tesis.')

    if args.publicar:
        publicar(resultados, sinteticas)


def publicar(resultados: dict, sinteticas: int) -> None:
    """Escribe la migración solo si los datos la sostienen. Publicar una
    versión entrenada con la semilla de demostración metería números
    inventados en la app y en la tesis."""
    if sinteticas:
        sys.exit('NO se publica: hay filas de la semilla de demostración en el entrenamiento.')
    flojas = [t for t, r in resultados.items()
              if r.get('n_personas', 0) < 20 or 'error' in r]
    if flojas:
        sys.exit(f'NO se publica: {", ".join(flojas)} sin muestra suficiente '
                 f'(se exigen 20 personas; ESP-005 §2 proyecta 60-100).')
    sys.exit('publicación pendiente de implementar: hacerlo cuando haya datos propios.')


if __name__ == '__main__':
    main()
