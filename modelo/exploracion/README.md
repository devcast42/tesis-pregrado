# Exploración: diario OLBI de Gruszczynska, Basinska y Schaufeli (2021)

Datos públicos (CC BY 4.0) del estudio *Within- and between-person factor structure
of the Oldenburg Burnout Inventory: analysis of a diary study using multilevel
confirmatory factor analysis*, PLOS One, doi:10.1371/journal.pone.0251257.
Datos: Mendeley Data, doi:10.17632/vwp3xvp2x8.2.

Sirven para **preentrenar y probar la mecánica** del modelo de ESP-005 antes de
tener datos propios. No sustituyen al estudio longitudinal: son empleados de la
administración pública polaca, no profesionales tecnológicos peruanos.

## Qué contiene

- 235 personas × 10 días laborales consecutivos (lunes a viernes, dos semanas).
- 8 ítems del OLBI en versión diaria ("Hoy…"): 4 de agotamiento (2E, 4E, 7E, 8E)
  y 4 de desvinculación (1D, 3D, 5D, 6D). Escala **1–5**, no 1–4 como el OLBI
  completo. Sin ítems invertidos.
- Sin faltantes: 2 350 persona-días completos.
- Sin variables de contexto ni demográficas. Solo el OLBI diario.

## Lo que se observó (`explorar.py`)

| Medida | Valor |
|---|---|
| Media total diaria (T) | 2.23 (DE 0.83), estable a lo largo de los 10 días |
| Correlación agotamiento–desvinculación | 0.75 por persona-día; 0.83 entre medias por persona |
| ICC (varianza entre personas / total) | ≈ 0.51 |
| Autocorrelación día a día de T | 0.40–0.60 |
| Días con T ≥ 3 ("de acuerdo" o más) | 22.7 % de los días; 69.8 % de las personas tuvo al menos uno |

Regresión logística regularizada, validación 5 pliegues **por persona** (GroupKFold):

| Tarea | Precisión | Recall | F1 | PR-AUC | ROC-AUC |
|---|---|---|---|---|---|
| Ventana de 3 días → día siguiente alto (n = 1 645, 23 % positivos) | 0.40 | 0.69 | 0.51 | 0.54 | 0.76 |
| Línea base «igual que ayer» | 0.51 | 0.49 | 0.50 | — | — |
| Semana 1 → semana 2 alta (n = 235, 11.5 % positivos) | 0.44 | 0.84 | 0.55 | 0.61 | 0.91 |

El coeficiente dominante fue la desvinculación media (0.93) sobre el agotamiento
medio (0.18): en estos datos la desvinculación sostenida anticipa mejor el día
alto siguiente que el agotamiento.

## Lo que esto implica para ESP-005

1. La mecánica funciona con datos reales: predecir el estado siguiente a partir
   de una ventana de días supera a la línea base ingenua y la tarea
   «semana → semana» (la más parecida a «próximo OLBI cruza el umbral») alcanza
   ROC-AUC 0.91 con solo 5 días de historia.
2. Para transferir los pesos hace falta que el check-in diario propio incluya
   estos mismos 8 ítems (o un subconjunto) en la misma escala. Ver ESP-002.
3. Agotamiento y desvinculación están tan correlacionados a nivel diario que un
   único puntaje total es defendible; el paper llega a la misma conclusión.
   Apoya el criterio (b) de detección (total ≥ 44) que está pendiente de decisión.
4. El umbral diario T ≥ 3 es una convención de esta exploración (el punto medio
   «ni de acuerdo ni en desacuerdo»); no existe punto de corte publicado para la
   versión diaria. La etiqueta de la tesis sigue siendo el OLBI completo con el
   umbral de Leclercq et al. (2021).

## Reproducir

```bash
python3 -m venv venv && ./venv/bin/pip install pandas pyreadstat scikit-learn
./venv/bin/python descargar.py   # baja el .sav de Mendeley y verifica el hash
./venv/bin/python explorar.py
```
