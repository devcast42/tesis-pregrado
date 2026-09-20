"""Preentrenamiento del modelo de ESP-005 §5 con el diario OLBI de referencia.

Produce los pesos iniciales `w₀` para dos tareas:
  NOWCAST    dado lo respondido de lunes a hoy (1 a 4 días), ¿el viernes saldrá alto?
  PRONÓSTICO dada la semana completa (lun-jue), ¿la PRÓXIMA semana será alta?
             Etiqueta de referencia: media de la segunda semana >= 3 (la
             agregación semanal es el análogo más cercano al OLBI completo,
             que es de rasgo, no de un día).

Los rasgos son EXACTAMENTE los de ESP-005 §4.1, calculados por `rasgos()`;
la función SQL `rasgos_semana` de la base tiene que producir los mismos
valores (CA-005-05). Se entrena con todos los prefijos de 1 a 4 días para
que el modelo sepa opinar el lunes con un solo día y el jueves con cuatro.

Salida: `modelo/versiones/*.json` y las migraciones que los cargan en
`modelo_versiones`. Se regeneran ejecutando este script (el entrenamiento es
determinista: mismos datos, mismos pesos).

Uso:
    cd modelo/exploracion && ../../<venv>/bin/python ../preentrenar.py
"""
import json
import pathlib
import sys
import warnings

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, brier_score_loss, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import GroupKFold

sys.path.insert(0, str(pathlib.Path(__file__).with_name('exploracion')))
from explorar import cargar_largo  # noqa: E402

warnings.filterwarnings('ignore')

VERSION = 'preentrenamiento-v1'
VERSION_PRONOSTICO = 'preentrenamiento-pronostico-v1'
# Los cuatro ítems del check-in propio y su equivalente en el diario polaco.
ITEMS = {'od_04': '2E', 'od_12': '7E', 'od_03': '1D', 'od_06': '3D'}
AGOT = ['od_04', 'od_12']
DESV = ['od_03', 'od_06']
RASGOS = ['T_media', 'T_ultimo', 'T_max', 'T_pendiente', 'E_media', 'D_media', 'n_dias']
UMBRAL_DIARIO = 3.0  # «alto» en escala 1-5: convención (ESP-005 §5.2)
C = 0.5


def rasgos(dias: list[dict]) -> dict:
    """Rasgos de ESP-005 §4.1 sobre los días respondidos hasta hoy.

    `dias`: lista ordenada de {clave_item: valor 1-5}. Tiene que coincidir
    con `rasgos_semana` en SQL."""
    T = np.array([np.mean([d[i] for i in ITEMS]) for d in dias])
    E = np.array([np.mean([d[i] for i in AGOT]) for d in dias])
    D = np.array([np.mean([d[i] for i in DESV]) for d in dias])
    n = len(dias)
    pend = float(np.polyfit(np.arange(n), T, 1)[0]) if n >= 2 else 0.0
    return {'T_media': T.mean(), 'T_ultimo': T[-1], 'T_max': T.max(), 'T_pendiente': pend,
            'E_media': E.mean(), 'D_media': D.mean(), 'n_dias': n}


def ejemplos_nowcast(L: pd.DataFrame) -> pd.DataFrame:
    filas = []
    for pid, g in L.groupby('id'):
        g = g.sort_values('dia').set_index('dia')
        for lunes, viernes in ((1, 5), (6, 10)):
            dias = [{k: g.loc[d, v] for k, v in ITEMS.items()} for d in range(lunes, lunes + 4)]
            y = int(g.loc[viernes, [v for v in ITEMS.values()] + ['4E', '8E', '5D', '6D']].mean() >= UMBRAL_DIARIO)
            for k in range(1, 5):
                fila = rasgos(dias[:k]); fila.update(id=pid, y=y)
                filas.append(fila)
    return pd.DataFrame(filas)


def ejemplos_pronostico(L: pd.DataFrame) -> pd.DataFrame:
    """Semana 1 (días 1-4) → semana 2 alta (media de los días 6-10, 8 ítems)."""
    filas = []
    for pid, g in L.groupby('id'):
        g = g.sort_values('dia').set_index('dia')
        dias = [{k: g.loc[d, v] for k, v in ITEMS.items()} for d in range(1, 5)]
        y = int(g.loc[6:10, list(ITEMS.values()) + ['4E', '8E', '5D', '6D']].values.mean() >= UMBRAL_DIARIO)
        fila = rasgos(dias); fila.update(id=pid, y=y)
        filas.append(fila)
    return pd.DataFrame(filas)


def validar(D: pd.DataFrame) -> dict:
    """Métricas por pliegue (persona) y por número de días respondidos."""
    p = np.zeros(len(D))
    for tr, te in GroupKFold(5).split(D, D.y, D.id):
        m = modelo().fit(D.loc[tr, RASGOS], D.loc[tr, 'y'])
        p[te] = m.predict_proba(D.loc[te, RASGOS])[:, 1]
    yh = (p >= 0.5).astype(int)
    global_ = {
        'precision': round(precision_score(D.y, yh), 3), 'recall': round(recall_score(D.y, yh), 3),
        'f1': round(f1_score(D.y, yh), 3), 'pr_auc': round(average_precision_score(D.y, p), 3),
        'roc_auc': round(roc_auc_score(D.y, p), 3), 'brier': round(brier_score_loss(D.y, p), 3),
        'n': int(len(D)), 'positivos': round(float(D.y.mean()), 3),
    }
    por_dias = {}
    for k in sorted(D.n_dias.unique()):
        sel = D.n_dias == k
        if D.y[sel].nunique() < 2: continue
        por_dias[str(int(k))] = {'roc_auc': round(roc_auc_score(D.y[sel], p[sel]), 3),
                            'precision': round(precision_score(D.y[sel], yh[sel]), 3),
                            'recall': round(recall_score(D.y[sel], yh[sel]), 3)}
    return {'global': global_, 'por_dias_respondidos': por_dias}


def modelo():
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    return make_pipeline(StandardScaler(), LogisticRegression(C=C, class_weight='balanced', max_iter=1000))


def entrenar(D: pd.DataFrame, nombre: str, tarea: str, etiqueta: str) -> tuple[dict, str]:
    metricas = validar(D)
    m = modelo().fit(D[RASGOS], D.y)
    esc, lr = m.named_steps['standardscaler'], m.named_steps['logisticregression']

    version = {
        'version': nombre, 'origen': 'preentrenamiento', 'tarea': tarea,
        'fuente': 'Gruszczynska, Basinska & Schaufeli (2021), Mendeley Data doi:10.17632/vwp3xvp2x8.2, CC BY 4.0',
        'rasgos': RASGOS,
        'medias': [round(float(x), 6) for x in esc.mean_],
        'desviaciones': [round(float(x), 6) for x in esc.scale_],
        'pesos': [round(float(x), 6) for x in lr.coef_[0]],
        'intercepto': round(float(lr.intercept_[0]), 6),
        'umbral_decision': 0.5,
        'etiqueta': etiqueta,
        'metricas': metricas,
    }
    destino = pathlib.Path(__file__).with_name('versiones')
    destino.mkdir(exist_ok=True)
    (destino / f'{nombre}.json').write_text(json.dumps(version, indent=2, ensure_ascii=False) + '\n')

    sql = f"""insert into modelo_versiones
  (version, origen, tarea, rasgos, medias, desviaciones, pesos, intercepto, umbral_decision, metricas, fuente, activa, visible_para)
values (
  '{nombre}', 'preentrenamiento', '{tarea}',
  '{json.dumps(RASGOS)}'::jsonb,
  '{json.dumps(version['medias'])}'::jsonb,
  '{json.dumps(version['desviaciones'])}'::jsonb,
  '{json.dumps(version['pesos'])}'::jsonb,
  {version['intercepto']}, 0.5,
  '{json.dumps(metricas)}'::jsonb,
  '{version['fuente']}',
  true,
  array['investigador', 'psicologo', 'participante']
)
on conflict (version) do update set
  rasgos = excluded.rasgos, medias = excluded.medias, desviaciones = excluded.desviaciones,
  pesos = excluded.pesos, intercepto = excluded.intercepto, metricas = excluded.metricas;
"""
    print(f'== {nombre}'); print(json.dumps(metricas, indent=2))
    print('pesos:', dict(zip(RASGOS, version['pesos'])), 'b =', version['intercepto'])
    return version, sql


def main():
    L = cargar_largo(pathlib.Path(__file__).with_name('exploracion') / 'olbi_diario.sav')
    _, sql_now = entrenar(ejemplos_nowcast(L), VERSION, 'nowcast',
                          f'media diaria de 8 ítems >= {UMBRAL_DIARIO} en escala 1-5 el viernes (no es el OLBI completo)')
    _, sql_pro = entrenar(ejemplos_pronostico(L), VERSION_PRONOSTICO, 'pronostico',
                          f'media de la semana siguiente (8 ítems, 5 días) >= {UMBRAL_DIARIO} en escala 1-5')
    migraciones = pathlib.Path(__file__).parents[1] / 'supabase' / 'migrations'
    cabecera = ("-- Generado por modelo/preentrenar.py. NO editar a mano: volver a ejecutar el script.\n"
                "-- Versión preentrenada del modelo de ESP-005 ({tarea}) con el diario OLBI de\n"
                "-- referencia. Métricas de validación por persona (5 pliegues) sobre los datos\n"
                "-- de referencia, no sobre datos propios.\n\n")
    # Una migración por tarea: la de nowcast ya está aplicada y no debe cambiar.
    (migraciones / '20260918130000_modelo_version_preentrenamiento.sql').write_text(cabecera.format(tarea='nowcast') + sql_now)
    (migraciones / '20260918140000_modelo_version_pronostico.sql').write_text(cabecera.format(tarea='pronóstico') + sql_pro)
    print('escritas las migraciones 20260918130000 y 20260918140000')


if __name__ == '__main__':
    main()
