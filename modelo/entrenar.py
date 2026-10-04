"""Modelo de desgaste — versión de producto.

Una tarea, un modelo, nueve entradas.

    ¿El próximo OLBI de esta persona saldrá alto?

Entradas: el resumen de su última semana de check-ins.

    ánimo    t_media, t_ultimo, t_max, t_pendiente, e_media, d_media, n_dias
    contexto sueno_media, horas_media

Los siete de ánimo llegan con pesos ya calculados de Gruszczyńska, Basińska y
Schaufeli (2021), así que el sistema opina desde el primer día de una empresa
nueva. Los dos de contexto arrancan en cero y se aprenden con los datos de esa
empresa: la penalización L2 tira hacia `w₀` en los primeros y hacia cero en los
segundos.

Esta rama es el producto, no la tesis. Lo que vive en `main` —las versiones
A/B/D/F, el control sin preentrenamiento, el random forest, las cuatro líneas
base, el análisis de potencia y la cohorte simulada— es el aparato que sostiene
un capítulo de resultados. Aquí sobra: lo que se vende es el circuito completo
—medir, detectar, derivar, atender, reportar— y el modelo es el disparador.

Uso:
    modelo/exploracion/venv/bin/python modelo/entrenar.py
    modelo/exploracion/venv/bin/python modelo/entrenar.py --publicar
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import psycopg
from scipy.optimize import minimize
from scipy.special import expit
from sklearn.metrics import (average_precision_score, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import GroupKFold

RAIZ = pathlib.Path(__file__).parent
DSN = ('postgresql://postgres.tnllaabrtntlmobtnhfp:{clave}'
       '@aws-0-us-east-1.pooler.supabase.com:6543/postgres')

# --------------------------------------------------------------------- diseño

# Los siete que vienen preentrenados. El orden es el de `pesos` en
# modelo_versiones y en el JSON de w0: no se reordena.
ANIMO = ['t_media', 't_ultimo', 't_max', 't_pendiente', 'e_media', 'd_media', 'n_dias']
# Cómo se llama cada uno en el archivo del preentrenamiento.
EN_W0 = {'t_media': 'T_media', 't_ultimo': 'T_ultimo', 't_max': 'T_max',
         't_pendiente': 'T_pendiente', 'e_media': 'E_media', 'd_media': 'D_media',
         'n_dias': 'n_dias'}
# Los dos del check-in que no existen en el estudio de referencia.
CONTEXTO = ['sueno_media', 'horas_media']
RASGOS = ANIMO + CONTEXTO

ETIQUETA = 'alto_t1'          # el OLBI de la semana siguiente
W0 = 'preentrenamiento-pronostico-v1'
VERSION = 'producto-v1'

# Fuerza de la penalización hacia w0 en los rasgos de ánimo. Grande = me fío
# del estudio de referencia; pequeña = mandan los datos de la empresa. Se
# elige en validación, no a dedo.
REJILLA_LAMBDA = [0.1, 0.3, 1.0, 3.0, 10.0]
LAMBDA_CONTEXTO = 1.0         # los dos propios se regularizan hacia cero
PLIEGUES = 5
PLIEGUES_UMBRAL = 3
# Un falso negativo es alguien quemándose al que nadie llama; un falso
# positivo, una conversación de más. El umbral pesa el recall cuatro veces
# más que la precisión.
BETA = 2.0
MINIMO_PERSONAS = 20
SINTETICOS = ("DEMO-%", "SIM-%")

# ---------------------------------------------------------------------- datos


def cargar(incluir_demo: bool = False) -> pd.DataFrame:
    clave = os.environ.get('SUPABASE_DB_PASSWORD')
    if not clave:
        sys.exit('falta SUPABASE_DB_PASSWORD en el entorno (source ~/.zshrc)')
    filtro = '' if incluir_demo else (
        "where p.codigo_anonimo not like 'DEMO-%' and p.codigo_anonimo not like 'SIM-%'")
    with psycopg.connect(DSN.format(clave=clave)) as cx:
        cx.execute('reset role')
        cur = cx.execute(f"""
            select s.trabajador_id, s.semana, s.{ETIQUETA},
                   {', '.join('s.' + r for r in RASGOS)},
                   p.codigo_anonimo
            from semanas_modelo s
            join trabajadores p on p.id = s.trabajador_id
            {filtro}
            order by s.trabajador_id, s.semana
        """)
        D = pd.DataFrame(cur.fetchall(), columns=[d.name for d in cur.description])
    for c in RASGOS + [ETIQUETA]:
        D[c] = pd.to_numeric(D[c], errors='coerce')
    return D


def preparar(D: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Filas con etiqueta y con al menos un día respondido. Los huecos de
    sueño y jornada se rellenan con la mediana: una persona que no contestó
    esos dos campos sigue teniendo señal de ánimo."""
    d = D.dropna(subset=[ETIQUETA]).copy()
    d = d[d['n_dias'] > 0]
    for r in RASGOS:
        d[r] = d[r].fillna(d[r].median() if d[r].notna().any() else 0.0)
    return d, d[ETIQUETA].to_numpy(int), d['trabajador_id'].astype(str).to_numpy()


def w0_de(version: str) -> dict | None:
    ruta = RAIZ / 'versiones' / f'{version}.json'
    if not ruta.exists():
        return None
    v = json.loads(ruta.read_text())
    return {'pesos': dict(zip(v['rasgos'], v['pesos'])),
            'medias': dict(zip(v['rasgos'], v['medias'])),
            'desviaciones': dict(zip(v['rasgos'], v['desviaciones']))}


# --------------------------------------------------------------------- ajuste


def tipificar(D: pd.DataFrame, w0: dict | None,
              stats: dict | None = None) -> tuple[np.ndarray, dict]:
    """Deja cada rasgo en «pasos desde lo normal».

    Los de ánimo usan la escala del preentrenamiento: si se usara otra, sus
    pesos dejarían de significar lo mismo. Los de contexto usan la de la
    muestra, calculada en el pliegue de entrenamiento y aplicada al de prueba
    —con la muestra entera se filtraría información entre pliegues—."""
    if stats is None:
        stats = {}
        for r in RASGOS:
            if w0 is not None and r in ANIMO:
                mu, sd = w0['medias'][EN_W0[r]], w0['desviaciones'][EN_W0[r]]
            else:
                mu, sd = float(D[r].mean()), float(D[r].std(ddof=0))
            stats[r] = (mu, sd or 1.0)
    X = np.column_stack([(D[r].to_numpy(float) - stats[r][0]) / stats[r][1] for r in RASGOS])
    return X, stats


def ajustar(X: np.ndarray, y: np.ndarray, ancla: np.ndarray,
            lam: np.ndarray) -> tuple[np.ndarray, float]:
    """Logística con penalización L2 hacia `ancla`. El intercepto no se penaliza.

    `peso` iguala el total de cada clase: sin eso, con un 15 % de positivos el
    modelo aprende a decir «no» siempre y acierta el 85 %."""
    n, k = X.shape
    peso = np.ones(n)
    for clase in (0, 1):
        sel = y == clase
        if sel.sum():
            peso[sel] = n / (2.0 * sel.sum())

    def objetivo(theta):
        w, b = theta[:k], theta[k]
        z = X @ w + b
        perdida = np.sum(peso * (np.logaddexp(0.0, z) - y * z)) / peso.sum()
        dif = w - ancla
        g = (peso * (expit(z) - y)) / peso.sum()
        return (perdida + 0.5 * float(lam @ dif ** 2),
                np.concatenate([X.T @ g + lam * dif, [g.sum()]]))

    r = minimize(objetivo, np.concatenate([ancla, [0.0]]), jac=True, method='L-BFGS-B')
    return r.x[:k], float(r.x[k])


def ancla_y_lambda(w0: dict | None, lam_animo: float) -> tuple[np.ndarray, np.ndarray]:
    ancla = np.array([w0['pesos'][EN_W0[r]] if (w0 and r in ANIMO) else 0.0 for r in RASGOS])
    lam = np.array([lam_animo if (w0 and r in ANIMO) else LAMBDA_CONTEXTO for r in RASGOS])
    return ancla, lam


def umbral_fbeta(y: np.ndarray, p: np.ndarray) -> float:
    mejor, mejor_u = -1.0, 0.5
    for u in np.unique(np.round(p, 3)):
        yh = (p >= u).astype(int)
        vp = int(((yh == 1) & (y == 1)).sum())
        if not vp:
            continue
        prec = vp / max(int((yh == 1).sum()), 1)
        rec = vp / max(int((y == 1).sum()), 1)
        f = (1 + BETA ** 2) * prec * rec / (BETA ** 2 * prec + rec)
        if f > mejor:
            mejor, mejor_u = f, float(u)
    return mejor_u


# ----------------------------------------------------------------- evaluación


def metricas(y: np.ndarray, p: np.ndarray, u: float) -> dict:
    yh = (p >= u).astype(int)
    dos = len(np.unique(y)) == 2
    return {
        'precision': round(float(precision_score(y, yh, zero_division=0)), 3),
        'recall': round(float(recall_score(y, yh, zero_division=0)), 3),
        'f1': round(float(f1_score(y, yh, zero_division=0)), 3),
        'pr_auc': round(float(average_precision_score(y, p)), 3) if dos else None,
        'roc_auc': round(float(roc_auc_score(y, p)), 3) if dos else None,
    }


def validar(d: pd.DataFrame, y: np.ndarray, grupos: np.ndarray,
            w0: dict | None, lam_animo: float) -> dict | None:
    """GroupKFold por persona: todas las semanas de alguien caen en el mismo
    pliegue. Repartirlas haría que el modelo reconociera a la persona en vez
    del fenómeno, y la nota saldría mejor de la que merece."""
    n_pliegues = min(PLIEGUES, len(np.unique(grupos)))
    if n_pliegues < 2 or len(np.unique(y)) < 2:
        return None
    ancla, lam = ancla_y_lambda(w0, lam_animo)
    por_pliegue = []
    for tr, te in GroupKFold(n_splits=n_pliegues).split(d, y, grupos):
        if len(np.unique(y[tr])) < 2 or len(np.unique(y[te])) < 2:
            continue
        Xtr, stats = tipificar(d.iloc[tr], w0)
        Xte, _ = tipificar(d.iloc[te], w0, stats)
        w, b = ajustar(Xtr, y[tr], ancla, lam)
        # El umbral se elige con predicciones fuera de muestra dentro del
        # pliegue de entrenamiento. Con las de dentro saldría optimista.
        u = umbral_interno(d.iloc[tr], y[tr], grupos[tr], w0, ancla, lam)
        por_pliegue.append(metricas(y[te], expit(Xte @ w + b), u))
    if not por_pliegue:
        return None
    out = {}
    for m in ('precision', 'recall', 'f1', 'pr_auc', 'roc_auc'):
        vals = [f[m] for f in por_pliegue if f.get(m) is not None]
        out[m] = {'media': round(float(np.mean(vals)), 3),
                  'de': round(float(np.std(vals)), 3)} if vals else None
    return {'pliegues': len(por_pliegue), 'resumen': out}


def umbral_interno(d: pd.DataFrame, y: np.ndarray, grupos: np.ndarray,
                   w0: dict | None, ancla: np.ndarray, lam: np.ndarray) -> float:
    n = min(PLIEGUES_UMBRAL, len(np.unique(grupos)))
    if n < 2:
        return 0.5
    p = np.zeros(len(y))
    for tr, te in GroupKFold(n_splits=n).split(d, y, grupos):
        if len(np.unique(y[tr])) < 2:
            continue
        Xtr, stats = tipificar(d.iloc[tr], w0)
        Xte, _ = tipificar(d.iloc[te], w0, stats)
        w, b = ajustar(Xtr, y[tr], ancla, lam)
        p[te] = expit(Xte @ w + b)
    return umbral_fbeta(y, p)


def base_referencia(d: pd.DataFrame, y: np.ndarray, w0: dict | None) -> dict | None:
    """Los pesos de referencia aplicados tal cual, sin reentrenar.

    Es la línea base que importa en un producto: si el modelo entrenado con
    los datos de la empresa no la supera, no hacía falta entrenar nada. No
    lleva particiones y no las necesita —nada se ajusta con estos datos—."""
    if not w0:
        return None
    z = np.zeros(len(d))
    for r in ANIMO:
        mu, sd = w0['medias'][EN_W0[r]], w0['desviaciones'][EN_W0[r]] or 1.0
        z += w0['pesos'][EN_W0[r]] * (d[r].to_numpy(float) - mu) / sd
    return metricas(y, expit(z), 0.5)


# ------------------------------------------------------------------- ejecución


def entrenar(d: pd.DataFrame, y: np.ndarray, grupos: np.ndarray, w0: dict | None) -> dict:
    """Elige la fuerza hacia w0 en validación y devuelve el modelo final."""
    mejor = None
    for lam_animo in (REJILLA_LAMBDA if w0 else [0.0]):
        m = validar(d, y, grupos, w0, lam_animo)
        if not m:
            continue
        pr = (m['resumen'].get('pr_auc') or {}).get('media') or 0
        if mejor is None or pr > mejor[1]:
            mejor = (lam_animo, pr, m)
    if mejor is None:
        return {'error': 'no hay pliegues evaluables: hacen falta más personas o más casos'}

    lam_animo, _, val = mejor
    ancla, lam = ancla_y_lambda(w0, lam_animo)
    X, stats = tipificar(d, w0)
    w, b = ajustar(X, y, ancla, lam)
    return {
        'version': VERSION,
        'lambda_hacia_w0': lam_animo,
        'rasgos': RASGOS,
        'pesos': [round(float(x), 6) for x in w],
        'intercepto': round(b, 6),
        'medias': [round(stats[r][0], 6) for r in RASGOS],
        'desviaciones': [round(stats[r][1], 6) for r in RASGOS],
        'umbral_decision': round(umbral_interno(d, y, grupos, w0, ancla, lam), 3),
        'validacion': val,
    }


def informe(incluir_demo: bool) -> dict:
    D = cargar(incluir_demo)
    d, y, grupos = preparar(D)
    personas = int(len(np.unique(grupos)))
    w0 = w0_de(W0)
    res = {
        'version': VERSION,
        'tarea': 'el próximo OLBI saldrá alto',
        'etiqueta': ETIQUETA,
        'n_filas': int(len(d)),
        'n_personas': personas,
        'positivos': round(float(y.mean()), 3) if len(y) else None,
        'casos_por_rasgo': round(float(y.sum()) / len(RASGOS), 1) if len(y) else None,
        'preentrenamiento': W0 if w0 else None,
        'sinteticas': int(d['codigo_anonimo'].str.startswith(('DEMO-', 'SIM-')).sum()),
        'entrenado_en': datetime.now(timezone.utc).isoformat(),
        'linea_base_referencia': base_referencia(d, y, w0),
        'modelo': entrenar(d, y, grupos, w0) if len(d) else {'error': 'sin filas'},
    }
    return res


def imprimir(r: dict) -> None:
    print(f"\n=== {r['tarea'].upper()} ===")
    print(f"  filas {r['n_filas']}  personas {r['n_personas']}  "
          f"positivos {r['positivos']}  casos/rasgo {r['casos_por_rasgo']}")
    if r['sinteticas']:
        print(f"  ⚠ {r['sinteticas']} filas sintéticas (DEMO/SIM): esto es un ensayo, no un resultado")
    b = r.get('linea_base_referencia')
    if b:
        print(f"  base  sin reentrenar      recall {b['recall']:.2f}  f1 {b['f1']:.2f}  "
              f"roc_auc {b['roc_auc'] if b['roc_auc'] is not None else '—'}")
    m = r['modelo']
    if 'error' in m:
        print('  ', m['error'])
        return
    v = m['validacion']['resumen']

    def g(k):
        return f"{v[k]['media']:.2f}±{v[k]['de']:.2f}" if v.get(k) else "  —  "
    print(f"  {VERSION}  lam={m['lambda_hacia_w0']}  umbral={m['umbral_decision']}  "
          f"recall {g('recall')}  f1 {g('f1')}  pr_auc {g('pr_auc')}  roc_auc {g('roc_auc')}")
    print('\n  pesos:')
    for n, p in zip(m['rasgos'], m['pesos']):
        print(f"    {n:14} {p:+.4f}{'   (preentrenado)' if n in ANIMO else ''}")
    print(f"    {'intercepto':14} {m['intercepto']:+.4f}")


def publicar(r: dict) -> None:
    """Carga la versión en `modelo_versiones` y la deja activa.

    Se niega con datos sintéticos o con menos de 20 personas: una empresa no
    puede estar recibiendo avisos de un modelo entrenado con gente inventada."""
    if r['sinteticas']:
        sys.exit(f"no se publica: {r['sinteticas']} filas sintéticas en el entrenamiento")
    if r['n_personas'] < MINIMO_PERSONAS:
        sys.exit(f"no se publica: {r['n_personas']} personas, el mínimo es {MINIMO_PERSONAS}")
    m = r['modelo']
    if 'error' in m:
        sys.exit(f"no se publica: {m['error']}")
    clave = os.environ['SUPABASE_DB_PASSWORD']
    with psycopg.connect(DSN.format(clave=clave)) as cx:
        cx.execute('reset role')
        cx.execute("update modelo_versiones set activa = false where tarea = 'pronostico'")
        cx.execute("""
            insert into modelo_versiones
              (version, origen, tarea, rasgos, medias, desviaciones, pesos, intercepto,
               umbral_decision, metricas, fuente, activa, visible_para)
            values (%s, 'propio', 'pronostico', %s, %s, %s, %s, %s, %s, %s, %s, true,
                    array['investigador','psicologo','trabajador'])
            on conflict (version) do update set
              rasgos = excluded.rasgos, medias = excluded.medias,
              desviaciones = excluded.desviaciones, pesos = excluded.pesos,
              intercepto = excluded.intercepto, umbral_decision = excluded.umbral_decision,
              metricas = excluded.metricas, activa = true
        """, (m['version'], json.dumps(m['rasgos']), json.dumps(m['medias']),
              json.dumps(m['desviaciones']), json.dumps(m['pesos']), m['intercepto'],
              m['umbral_decision'], json.dumps(m['validacion']),
              f"entrenado con {r['n_personas']} personas, {r['n_filas']} semanas"))
    print(f"\npublicada {m['version']} y activa para pronóstico")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--demo', action='store_true',
                    help='incluye trabajadores DEMO-*/SIM-*: ensayo, nunca un resultado')
    ap.add_argument('--publicar', action='store_true',
                    help='carga la versión en modelo_versiones y la deja activa')
    args = ap.parse_args()

    r = informe(args.demo)
    imprimir(r)
    salida = RAIZ / 'resultados' / ('ensayo-demo.json' if args.demo else 'producto.json')
    salida.write_text(json.dumps(r, indent=2, ensure_ascii=False))
    print(f"\nresultados en {salida.relative_to(RAIZ.parent)}")
    if args.publicar:
        publicar(r)


if __name__ == '__main__':
    main()
