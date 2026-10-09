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
# v2: la etiqueta pide las dos dimensiones altas, como la detección del
# producto (`evaluar-olbi`). La v1 usaba la media de los 8 ítems juntos.
VERSION_V2 = 'preentrenamiento-v2'
# v3: semanas de cinco días. El check-in pasa a ser de lunes a viernes (el
# viernes ya no es el día del OLBI), así que el modelo aprende con 1 a 5 días
# y lo que estima es el estado de la SEMANA, no el de un viernes concreto.
VERSION_V3 = 'preentrenamiento-v3'
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


E8 = ['2E', '7E', '4E', '8E']
D8 = ['1D', '3D', '5D', '6D']


def alto_media(fila: pd.Series) -> bool:
    """v1: la media de los 8 ítems del día, juntos."""
    return fila[E8 + D8].mean() >= UMBRAL_DIARIO


def alto_ambas(fila: pd.Series) -> bool:
    """v2: agotamiento Y desvinculación, cada una con su media de 4 ítems.

    El corte se queda en 3 de 5 en las dos. Reescalar los del producto
    (2.875 y 2.75 de 4 → 3.50 y 3.33 de 5) deja un 4 % de positivos en el
    diario de referencia y el modelo acierta 1 de cada 12 avisos."""
    return fila[E8].mean() >= UMBRAL_DIARIO and fila[D8].mean() >= UMBRAL_DIARIO


# Las cuatro preguntas del diario de referencia que el check-in NO hace. La
# etiqueta de v3 sale de ellas: con las mismas cuatro del check-in, el modelo
# veía la mitad de la respuesta y daba un AUC de 0.96 que no se sostiene.
OTRAS_E = ['4E', '8E']
OTRAS_D = ['5D', '6D']


def alto_semana(g: pd.DataFrame, lunes: int) -> bool:
    """v3: agotamiento Y desvinculación de la semana (5 días), cada una con
    su media de las preguntas que el check-in no hace, sobre 3 de 5."""
    semana = g.loc[lunes:lunes + 4]
    return semana[OTRAS_E].values.mean() >= UMBRAL_DIARIO and semana[OTRAS_D].values.mean() >= UMBRAL_DIARIO


def ejemplos_semana(L: pd.DataFrame) -> pd.DataFrame:
    """Cada semana de 5 días, con los prefijos de 1 a 5 días respondidos."""
    filas = []
    for pid, g in L.groupby('id'):
        g = g.sort_values('dia').set_index('dia')
        for lunes in (1, 6):
            dias = [{k: g.loc[d, v] for k, v in ITEMS.items()} for d in range(lunes, lunes + 5)]
            y = int(alto_semana(g, lunes))
            for k in range(1, 6):
                fila = rasgos(dias[:k]); fila.update(id=pid, y=y)
                filas.append(fila)
    return pd.DataFrame(filas)


def ejemplos_nowcast(L: pd.DataFrame, alto=alto_media) -> pd.DataFrame:
    filas = []
    for pid, g in L.groupby('id'):
        g = g.sort_values('dia').set_index('dia')
        for lunes, viernes in ((1, 5), (6, 10)):
            dias = [{k: g.loc[d, v] for k, v in ITEMS.items()} for d in range(lunes, lunes + 4)]
            y = int(alto(g.loc[viernes]))
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


def entrenar(D: pd.DataFrame, nombre: str, tarea: str, etiqueta: str, activa: bool = True) -> tuple[dict, str]:
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
  {'true' if activa else 'false'},
  array['investigador', 'psicologo', 'trabajador']
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
    migraciones = pathlib.Path(__file__).resolve().parents[1] / 'supabase' / 'migrations'
    cabecera = ("-- Generado por modelo/preentrenar.py. NO editar a mano: volver a ejecutar el script.\n"
                "-- Versión preentrenada del modelo de ESP-005 ({tarea}) con el diario OLBI de\n"
                "-- referencia. Métricas de validación por persona (5 pliegues) sobre los datos\n"
                "-- de referencia, no sobre datos propios.\n\n")
    # Una migración por tarea: la de nowcast ya está aplicada y no debe cambiar.
    (migraciones / '20260918130000_modelo_version_preentrenamiento.sql').write_text(cabecera.format(tarea='nowcast') + sql_now)
    (migraciones / '20260918140000_modelo_version_pronostico.sql').write_text(cabecera.format(tarea='pronóstico') + sql_pro)
    print('escritas las migraciones 20260918130000 y 20260918140000')

    # v2 se guarda sin activar: se pone en uso desde Versiones.
    _, sql_v2 = entrenar(ejemplos_nowcast(L, alto_ambas), VERSION_V2, 'nowcast',
                         f'agotamiento >= {UMBRAL_DIARIO} y desvinculación >= {UMBRAL_DIARIO} (4 ítems cada una, escala 1-5) el viernes',
                         activa=False)
    (migraciones / '20261008180000_modelo_version_v2.sql').write_text(
        cabecera.format(tarea='nowcast, v2: las dos dimensiones, como la detección') + sql_v2)
    print('escrita la migración 20261008180000')

    # v3 se crea sin activar; la migración la pone en uso con un UPDATE para
    # que quede fechada (`activada_en`).
    _, sql_v3 = entrenar(ejemplos_semana(L), VERSION_V3, 'nowcast',
                         f'semana de 5 días: agotamiento (4E, 8E) y desvinculación (5D, 6D) >= {UMBRAL_DIARIO} en escala 1-5, preguntas que el check-in no hace',
                         activa=False)
    (migraciones / '20261009150000_modelo_version_v3.sql').write_text(
        cabecera.format(tarea='nowcast, v3: semanas de 5 días') + sql_v3
        + "\n-- En uso desde ya: el check-in pasa a ser de lunes a viernes y v2 solo\n"
          "-- sabe opinar con 1 a 4 días.\n"
          "update modelo_versiones set activa = false where tarea = 'nowcast' and version <> 'preentrenamiento-v3';\n"
          "update modelo_versiones set activa = true where version = 'preentrenamiento-v3';\n")
    print('escrita la migración 20261009150000')


if __name__ == '__main__':
    main()
