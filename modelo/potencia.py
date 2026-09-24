"""¿Con esta muestra se puede medir algo? — análisis de potencia para ESP-005.

Responde una pregunta distinta de «¿el sueño predice el burnout?». Esa es
empírica y necesita datos reales. Esta es estadística y se puede contestar hoy:

    Suponiendo que el bloque objetivo SÍ funcione de verdad, con N personas
    y 6 semanas, ¿qué tan preciso sería el número que mediríamos?

Importa para decidir si conviene apostar la tesis solo al bloque objetivo. Si
con la muestra factible el resultado medido puede caer entre 0.50 y 0.80
dependiendo de a quién te tocó reclutar, entonces un resultado aislado no
distingue «funciona» de «no funciona», y quedarse sin plan B es caro.

El truco: se fija por construcción un efecto objetivo REAL y conocido
(`FUERZA_OBJETIVA`), se simulan muchas cohortes y se mira cuánto se mueve la
estimación. La conclusión no es sobre el burnout —el efecto lo pusimos
nosotros— sino sobre el instrumento de medida.

Uso:
    modelo/exploracion/venv/bin/python modelo/potencia.py
"""
from __future__ import annotations

import pathlib
import sys

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

RAIZ = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ))
import simular as S  # noqa: E402

TAMANOS = [40, 60, 80, 120, 200]
REPETICIONES = 12

# Rasgos de cada bloque, calculados por semana igual que en `semanas_modelo`.
ANIMO = ['t_media', 't_ultimo', 't_max', 't_pendiente', 'e_media', 'd_media', 'n_dias']
OBJETIVO = ['sueno_media', 'sueno_min', 'horas_media', 'horas_max',
            'desconexion_media', 'contacto_fuera_horario']


def rasgos_semana(dias: list[dict]) -> dict | None:
    """Los mismos resúmenes que la vista `semanas_modelo`."""
    if not dias:
        return None
    t = np.array([np.mean([d['od_04'], d['od_12'], d['od_03'], d['od_06']]) for d in dias])
    e = np.array([np.mean([d['od_04'], d['od_12']]) for d in dias])
    dv = np.array([np.mean([d['od_03'], d['od_06']]) for d in dias])
    n = len(dias)
    idx = np.arange(n, dtype=float)
    pend = float(np.polyfit(idx, t, 1)[0]) if n >= 2 else 0.0
    horas = np.array([d['horas_trabajadas'] for d in dias])
    sueno = np.array([d['horas_sueno'] for d in dias])
    return {
        't_media': t.mean(), 't_ultimo': t[-1], 't_max': t.max(), 't_pendiente': pend,
        'e_media': e.mean(), 'd_media': dv.mean(), 'n_dias': float(n),
        'horas_media': horas.mean(), 'horas_max': horas.max(),
        'sueno_media': sueno.mean(), 'sueno_min': sueno.min(),
        'desconexion_media': float(np.mean([d['desconexion'] for d in dias])),
        'contacto_fuera_horario': float(np.mean([d['contacto_fuera_horario'] for d in dias])),
    }


def cohorte(n_personas: int, semilla: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[str]]:
    rng = np.random.default_rng(semilla)
    filas, etiquetas, grupos = [], [], []
    for i in range(1, n_personas + 1):
        p = S.generar_persona(rng, i)
        for s in S.generar_seguimiento(p, rng):
            r = rasgos_semana(s['dias'])
            if r is None:
                continue
            filas.append(r)
            etiquetas.append(int(s['alto']))
            grupos.append(i)
    columnas = ANIMO + OBJETIVO
    X = np.array([[f[c] for c in columnas] for f in filas])
    return X, np.array(etiquetas), np.array(grupos), columnas


def auc_cv(X: np.ndarray, y: np.ndarray, grupos: np.ndarray) -> float | None:
    """ROC-AUC fuera de muestra, con GroupKFold por persona."""
    if len(np.unique(y)) < 2 or len(np.unique(grupos)) < 5:
        return None
    p = np.full(len(y), np.nan)
    for tr, te in GroupKFold(n_splits=5).split(X, y, grupos):
        if len(np.unique(y[tr])) < 2:
            return None
        m = make_pipeline(StandardScaler(),
                          LogisticRegression(C=0.5, class_weight='balanced', max_iter=2000))
        m.fit(X[tr], y[tr])
        p[te] = m.predict_proba(X[te])[:, 1]
    return float(roc_auc_score(y, p)) if len(np.unique(y)) == 2 else None


def main() -> None:
    print(__doc__.split('Uso:')[0].strip())
    print(f'\nEfecto objetivo puesto por construcción: la recuperación mueve el agotamiento')
    print(f'(coeficiente 0.18 por punto de desconexión en modelo/simular.py).')
    print(f'{REPETICIONES} cohortes por tamaño.\n')

    cab = f"{'personas':>9} {'semanas':>8} {'positivos':>10} | {'ánimo: mediana (rango)':>28} | {'objetivo: mediana (rango)':>28}"
    print(cab)
    print('-' * len(cab))

    for n in TAMANOS:
        aucs_animo, aucs_obj, n_filas, n_pos = [], [], [], []
        for r in range(REPETICIONES):
            X, y, g, cols = cohorte(n, 4200 + r * 97 + n)
            if len(y) == 0:
                continue
            ia = [cols.index(c) for c in ANIMO]
            io = [cols.index(c) for c in OBJETIVO]
            a, o = auc_cv(X[:, ia], y, g), auc_cv(X[:, io], y, g)
            if a is not None:
                aucs_animo.append(a)
            if o is not None:
                aucs_obj.append(o)
            n_filas.append(len(y)); n_pos.append(int(y.sum()))

        def resumen(v):
            if not v:
                return '        —        '
            return f"{np.median(v):.2f}  ({min(v):.2f} – {max(v):.2f})"

        print(f"{n:>9} {int(np.mean(n_filas)):>8} {int(np.mean(n_pos)):>10} | "
              f"{resumen(aucs_animo):>28} | {resumen(aucs_obj):>28}")

    print("\nCómo leerlo: el rango es lo que podría salirte según a quién te toque")
    print("reclutar. Si incluye 0.50, una sola corrida no distingue «funciona» de")
    print("«no funciona». 0.50 = moneda al aire.")


if __name__ == '__main__':
    main()
