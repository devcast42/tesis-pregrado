"""Exploración del diario OLBI y prueba de concepto del modelo de ESP-005.

Regresión logística regularizada sobre una ventana de días anteriores, validada
por persona (GroupKFold) para que ningún trabajador esté a la vez en
entrenamiento y prueba.
"""
import warnings
import numpy as np
import pandas as pd
import pyreadstat
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import GroupKFold

warnings.filterwarnings('ignore')

ITEMS = ['1D', '2E', '3D', '4E', '5D', '6D', '7E', '8E']
AGOTAMIENTO = ['2E', '4E', '7E', '8E']
DESVINCULACION = ['1D', '3D', '5D', '6D']
DIAS = 10
VENTANA = 3
UMBRAL_DIARIO = 3.0  # punto medio de la escala 1-5; convención de esta exploración


def cargar_largo(ruta='olbi_diario.sav'):
    ancho, _ = pyreadstat.read_sav(ruta)
    filas = []
    for _, r in ancho.iterrows():
        for d in range(1, DIAS + 1):
            fila = {it: r[f'OLBI_{it}.{d}'] for it in ITEMS}
            fila.update(id=int(r['ID']), dia=d)
            filas.append(fila)
    largo = pd.DataFrame(filas)
    largo['E'] = largo[AGOTAMIENTO].mean(axis=1)
    largo['D'] = largo[DESVINCULACION].mean(axis=1)
    largo['T'] = largo[ITEMS].mean(axis=1)
    return largo


def descriptivos(L):
    print(f'personas: {L.id.nunique()}  persona-días: {len(L)}  faltantes: {L[ITEMS].isna().sum().sum()}')
    print('\nmedias por día:')
    print(L.groupby('dia')[['E', 'D', 'T']].mean().round(2).T)
    print(f'\ncorr E-D por persona-día: {L[["E", "D"]].corr().iloc[0, 1]:.3f}')
    medias = L.groupby('id')[['E', 'D']].mean()
    print(f'corr E-D entre medias por persona: {medias.corr().iloc[0, 1]:.3f}')
    icc = L.groupby('id')['T'].mean().var() / L['T'].var()
    print(f'ICC aproximado de T: {icc:.2f}')
    w = L.pivot(index='id', columns='dia', values='T')
    print('autocorrelación lag-1:', [round(w[d].corr(w[d + 1]), 2) for d in range(1, DIAS)])
    alto = L['T'] >= UMBRAL_DIARIO
    print(f'días con T >= {UMBRAL_DIARIO}: {alto.mean() * 100:.1f} %; '
          f'personas con >= 1 día alto: {(L.groupby("id")["T"].max() >= UMBRAL_DIARIO).mean() * 100:.1f} %')


def rasgos(prev):
    """Resumen de una ventana de días anteriores: lo que el modelo ve."""
    return {
        'E_media': prev.E.mean(),
        'D_media': prev.D.mean(),
        'T_ultimo': prev['T'].iloc[-1],
        'T_pendiente': np.polyfit(range(len(prev)), prev['T'], 1)[0],
        'T_max': prev['T'].max(),
    }


def ejemplos_dia_siguiente(L):
    filas = []
    for _, g in L.groupby('id'):
        g = g.sort_values('dia')
        for t in range(VENTANA, DIAS):
            x = rasgos(g.iloc[t - VENTANA:t])
            x['ayer_alto'] = int(g.iloc[t - 1]['T'] >= UMBRAL_DIARIO)
            x['y'] = int(g.iloc[t]['T'] >= UMBRAL_DIARIO)
            x['id'] = g.iloc[t].id
            filas.append(x)
    return pd.DataFrame(filas)


def ejemplos_semana_siguiente(L):
    filas = []
    for pid, g in L.groupby('id'):
        g = g.sort_values('dia')
        x = rasgos(g.iloc[:5])
        x['y'] = int(g.iloc[5:]['T'].mean() >= UMBRAL_DIARIO)
        x['id'] = pid
        filas.append(x)
    return pd.DataFrame(filas)


def evaluar(D, nombre):
    feats = ['E_media', 'D_media', 'T_ultimo', 'T_pendiente', 'T_max']
    res, coefs = [], []
    for tr, te in GroupKFold(n_splits=5).split(D, D.y, D.id):
        m = LogisticRegression(C=0.5, class_weight='balanced', max_iter=1000)
        m.fit(D.loc[tr, feats], D.loc[tr, 'y'])
        p = m.predict_proba(D.loc[te, feats])[:, 1]
        y, yh = D.loc[te, 'y'], (p >= 0.5).astype(int)
        res.append([precision_score(y, yh), recall_score(y, yh), f1_score(y, yh),
                    average_precision_score(y, p), roc_auc_score(y, p)])
        coefs.append(m.coef_[0])
    r = np.mean(res, axis=0)
    print(f'\n{nombre}: n={len(D)}, positivos {D.y.mean() * 100:.1f} %')
    print(f'  precisión {r[0]:.2f}  recall {r[1]:.2f}  F1 {r[2]:.2f}  PR-AUC {r[3]:.2f}  ROC-AUC {r[4]:.2f}')
    print('  coeficientes:', dict(zip(feats, np.round(np.mean(coefs, axis=0), 2))))
    if 'ayer_alto' in D:
        print(f'  línea base "igual que ayer": precisión {precision_score(D.y, D.ayer_alto):.2f}  '
              f'recall {recall_score(D.y, D.ayer_alto):.2f}  F1 {f1_score(D.y, D.ayer_alto):.2f}')


if __name__ == '__main__':
    L = cargar_largo()
    descriptivos(L)
    evaluar(ejemplos_dia_siguiente(L), f'Ventana de {VENTANA} días -> día siguiente alto')
    evaluar(ejemplos_semana_siguiente(L), 'Semana 1 -> semana 2 alta')
