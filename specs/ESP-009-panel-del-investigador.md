# ESP-009 · Panel del investigador

| | |
|---|---|
| **Estado** | Implementado (vistas, funciones y pantallas según Figma `NsWTiSKab9HJt9b2EBz7XA` y `2IqfFSK20uCzmuMg6SvaUZ`) · umbrales y límites del circuito pendientes del asesor (§9) |
| **Módulo** | `modules/panel`, `modules/investigador`, `app/investigador/` |
| **Depende de** | ESP-002 (recolección), ESP-003 (OLBI), ESP-005 (modelo), ESP-006 (roles), ESP-007 (adherencia), ESP-008 (maestros) |

## 1. Justificación en la tesis

El investigador es quien produce el capítulo de resultados. Los tres
indicadores del Anexo 3 (volumen evaluado, tiempo de detección, precisión)
salen de este panel, y la validación del modelo (HE1: el modelo detecta antes
que el corte del OLBI) exige comparar predicción contra resultado **por
persona y por semana**. Sin una vista unitaria, esa comparación se hace a
mano en Jupyter, no se puede auditar y no se puede explicar en una defensa.

Además, el estudio de campo se sostiene con trabajo diario: saber a quién
recordar, qué derivación no avanzó, qué cita nadie confirmó. Un panel que
solo muestre promedios deja ese trabajo a una hoja de cálculo.

## 2. Propósito

Dar al investigador el rol más amplio del sistema con tres entradas: la
**bandeja de hoy** (operación), los **tableros de cohorte y modelo**
(análisis) y la **ficha unitaria del participante** (caso a caso), con
exportación reproducible del dataset. Todo anonimizado por construcción: el
investigador trabaja con códigos; la identidad se abre solo por una acción
registrada (RF-006-12).

## 3. Fuera de alcance

- **Contenido clínico.** Ni transcripciones ni informes del psicólogo, ni
  siquiera aprobados (RN-004-03). El investigador ve que la sesión ocurrió y
  que el informe se aprobó, no qué dice.
- **Entrenamiento del modelo desde el panel.** Se muestran versiones y
  desempeño; entrenar sigue siendo `modelo/preentrenar.py` (ESP-005). Un botón
  «entrenar» se evalúa en §9.
- **Edición de respuestas.** El dataset es append-only; nada se corrige desde
  el panel.
- **Notificaciones al participante desde el panel.** Recordar es de la app y
  del sistema (ESP-007); contactar a una persona pasa por el admin de su
  empresa (RN-006-01).

## 4. Requisitos funcionales

**Bandeja de hoy**

| ID | Requisito |
|---|---|
| RF-009-01 | Una pantalla **Hoy** lista, agrupados por tipo y ordenados por antigüedad, los pendientes de operación: participantes activos con ≥ 4 días hábiles sin registro; semanas cerradas sin OLBI del viernes; detecciones sin derivación; derivaciones abiertas sin sesión en ≥ 7 días; citas `solicitadas` sin confirmar en ≥ 2 días; sesiones finalizadas sin informe aprobado en ≥ 7 días; participantes con consentimiento pendiente ≥ 7 días desde la inscripción. |
| RF-009-02 | Cada pendiente enlaza a la ficha, la derivación o la empresa que lo resuelve, y muestra a qué empresa pertenece para poder pedir el contacto al admin. |
| RF-009-03 | La bandeja muestra el conteo por tipo en la barra lateral (badge) para saber si hay trabajo sin abrirla. |

**Cohorte**

| ID | Requisito |
|---|---|
| RF-009-04 | El **Resumen** conserva los tres indicadores con su fórmula visible (numerador, denominador, ventana) y añade: cohorte por semana del estudio (inscritos, activos, detectados, retirados, finalizados), adherencia global y por empresa, versión del modelo activa por tarea. |
| RF-009-05 | Una pantalla **Cohorte** muestra el OLBI agregado **sin mínimo de reporte** (el investigador no está bajo RN-008-11): media y distribución por semana, % en nivel alto, y cortes por empresa, modalidad, rol y semana del estudio, más los factores JD-R con los mismos cortes. |
| RF-009-06 | Un filtro global de **empresa** y **rango de semanas** persiste entre pantallas y se refleja en la URL; una búsqueda global por código (`⌘K` / `Ctrl+K`) abre la ficha desde cualquier lugar. |

**Participantes**

| ID | Requisito |
|---|---|
| RF-009-07 | La tabla de participantes admite filtros combinables (empresa, estado, semana del estudio, nivel del último OLBI, nowcast ≥ umbral, días sin responder ≥ n, con derivación, con cita), búsqueda por código, columnas configurables, orden por cualquier columna con **urgencia** por defecto, y selección múltiple para exportar. |
| RF-009-08 | La **ficha del participante** reúne en una sola pantalla, con navegación por secciones: encabezado (código, empresa, semana N de 6, estado, adherencia, insignias detectado/derivado/cita); **calendario de respuestas** (6 semanas × L–V: respondió, no respondió, fin de semana, futuro, con hora de envío); **serie diaria** (los 4 ítems OLBI diarios, horas trabajadas, horas de sueño; los lunes las horas de fin de semana); **trayectoria OLBI** por dimensión con umbrales y el punto de detección; **modelo** (nowcast por día contra el resultado del viernes con acierto/fallo, pronóstico por semana contra lo ocurrido, versión y confianza); **respuestas ítem a ítem** por formulario y fecha; **línea de tiempo** de eventos (inicio, evaluaciones, detección con puntajes y umbrales, derivación, cita, sesión, informe aprobado —solo el hecho—, retiro, accesos a identidad). |
| RF-009-09 | Desde la ficha: exportar la ficha (CSV/JSON), ver identidad (acción explícita y registrada, RF-006-12), reasignar psicólogo de una derivación abierta, cerrar seguimiento (`finalizado`) con motivo, y navegar a anterior/siguiente participante según el filtro activo. |

**Derivaciones y circuito de apoyo**

| ID | Requisito |
|---|---|
| RF-009-10 | Derivaciones muestra los tiempos del circuito por caso y por psicólogo: detección → derivación → primera sesión → informe aprobado, con medianas y casos fuera de rango; incluye citas por estado y la carga abierta por psicólogo.  Las marcas de tiempo salen de `eventos`, no de `sesiones_consulta` ni `informes`: el investigador no lee esas tablas (RN-004-08) y la vista le devolvía todo «sin sesión» con los días en nulo, dejando el indicador OE2 sin medir. Corregido en `20260924150000_circuito_apoyo_desde_eventos.sql`. |

**Modelo**

| ID | Requisito |
|---|---|
| RF-009-11 | **Versiones**: tabla de `modelo_versiones` (versión, tarea, origen, métricas por número de días, `visible_para`, activa desde) con activar/desactivar por tarea. |
| RF-009-12 | **Desempeño observado** con datos propios: por tarea, matriz de confusión y precisión/recall/ROC-AUC calculados sobre las predicciones registradas contra el resultado real, por semana y acumulado; **calibración** (probabilidad dicha vs. frecuencia observada en deciles); comparación entre versiones cuando coexisten. Cada cifra con su n. |

**Datos y auditoría**

| ID | Requisito |
|---|---|
| RF-009-13 | **Exportación** del dataset anonimizado en CSV (y Parquet si el navegador lo permite) con diccionario de variables: `respuestas`, `respuestas_items`, `puntajes_olbi`, `ventanas_modelo`, `predicciones` (eventos `prediccion_modelo` aplanados), `eventos`; con el filtro global aplicado y un `manifest.json` (fecha, filtros, versión del esquema, conteos). |
| RF-009-14 | Auditoría (existente) añade filtros por psicólogo, participante y rango, y exporta. |
| RF-009-15 | Maestros (existentes) añaden la edición de `umbrales_empresa` (RN-008-13) y la reasignación de derivaciones al dar de baja a un psicólogo (ESP-008 §9.3). |

## 5. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-009-01 | Todo lo que el panel muestra sale de vistas o funciones del servidor; la app no recalcula indicadores ni métricas del modelo. | Una sola verdad: la que va al capítulo de resultados es la misma que se ve en pantalla (ya en ESP-006 RF-006-09; se extiende al modelo). |
| RN-009-02 | El investigador ve códigos, nunca nombres, en todas las pantallas; la identidad se abre por `obtener_identidad()` y queda en `eventos` (RN-006-03), también desde la ficha. | Reduce la exposición en el uso diario (RN-006-04) y deja rastro cuando hace falta. |
| RN-009-03 | Ninguna vista del investigador expone `transcripciones` ni `informes.contenido_*`; solo `informes.estado` y fechas. | Es material clínico de la relación terapéutica (RN-004-03). |
| RN-009-04 | El investigador **no** está sujeto al mínimo de reporte (RN-008-11): ve celdas de cualquier tamaño. | Es quien analiza el dato de investigación; el mínimo protege al participante frente al empleador, no frente al estudio que consintió. |
| RN-009-05 | Las métricas de desempeño se calculan solo sobre predicciones **registradas en su momento** (eventos `prediccion_modelo`), nunca recomputadas a posteriori con el modelo actual. | Recalcular con datos que el modelo no tenía ese día infla el desempeño; la tesis reporta lo que el sistema dijo cuando lo dijo. |
| RN-009-06 | Toda exportación deja un evento `exportacion_dataset` con filtros, conteos y hash del manifiesto. | Reproducibilidad: el capítulo de resultados puede citar qué extracción usó. |
| RN-009-07 | Cerrar seguimiento o reasignar psicólogo desde el panel deja evento con `por = 'investigador'` y motivo; nunca borra derivaciones ni respuestas. | Append-only (RN-001-03) y auditable. |
| RN-009-08 | Nada rojo salvo errores técnicos; «detectado» y «alto» van en tierra, las alertas de operación en ámbar. | Coherencia con el resto del sistema: el color no debe convertir un dato en un juicio. |
| RN-009-09 | Las vistas por participante (`historial_checkin`, etc.) se reescriben para la **versión 2** de los formularios (ítems `od_*`, `horas_fin_de_semana`, `semanal`) y leen las claves de la definición, no cableadas. | `historial_checkin` sigue leyendo `carga_percibida` y `energia_al_terminar`, que ya no existen en v2: hoy devuelve vacío. |

## 6. Contratos de datos

**Vistas y funciones nuevas** (todas `security_invoker = on`; RLS ya da al
investigador lectura sobre todo el esquema de investigación, ESP-006).

- `bandeja_investigador (tipo, participante_id, codigo_anonimo, organizacion_id, empresa, referencia_id, desde, dias)` — una fila por pendiente; `tipo ∈ {inactivo, sin_viernes, deteccion_sin_derivacion, derivacion_sin_sesion, cita_sin_confirmar, informe_pendiente, consentimiento_pendiente}`.
- `cohorte_semanal (organizacion_id, semana, inscritos, activos, detectados, retirados, finalizados, respondieron_viernes, olbi_agotamiento_media, olbi_desvinculacion_media, pct_alto, horas_dia_media, sueno_media, fin_de_semana_media, sobretiempo_media, guardia_pct, apoyo_lider_media)` — sin mínimo; `organizacion_id` nulo = todo el estudio.
- `calendario_respuestas (participante_id, dia, formulario_clave, enviado_en)` — una fila por respuesta con día local.
- `serie_diaria_v2 (participante_id, dia, od_04, od_12, od_03, od_06, horas_trabajadas, horas_sueno, horas_fin_de_semana)` — reemplaza a `historial_checkin`, ya retirada.
- `predicciones_participante (participante_id, tarea, version, dia, semana, probabilidad, n_dias, resultado_real, acierto)` — eventos `prediccion_modelo` aplanados y unidos al OLBI de la semana correspondiente (nowcast: viernes de esa semana; pronóstico: viernes de la siguiente).
- `desempeno_modelo (tarea, version, semana, n, vp, fp, vn, fn, precision, recall, especificidad)` y `calibracion_modelo (tarea, version, decil, n, prob_media, frecuencia_observada)`.
- `circuito_apoyo (derivacion_id, participante_id, psicologo_id, detectado_en, derivado_en, primera_sesion_en, informe_aprobado_en, dias_a_derivacion, dias_a_sesion, dias_a_informe, estado)`.
- `ficha_participante(p_id) → jsonb` — encabezado de la ficha en una llamada (código, empresa, estado, semana, adherencia, derivación abierta, cita vigente, última predicción).
- Funciones de acción: `cerrar_seguimiento(p_id, motivo)`, `reasignar_derivacion(derivacion_id, psicologo_id)`, `registrar_exportacion(filtros jsonb, conteos jsonb, hash text)`.

**Eventos nuevos**: `exportacion_dataset`, `reasignacion_psicologo`.

**Exportación** (`modules/investigador/exportar.ts`): genera en el navegador un ZIP con `respuestas.csv`, `respuestas_items.csv`, `puntajes_olbi.csv`, `ventanas_modelo.csv`, `predicciones.csv`, `eventos.csv`, `diccionario.md`, `manifest.json`.

## 7. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-009-01 | Dado un participante activo sin registro en 4 días hábiles, cuando el investigador abre Hoy, entonces aparece en «inactivos» con su empresa y un enlace a la ficha. | Automatizable (SQL sobre `bandeja_investigador`) |
| CA-009-02 | Dada una detección sin derivación (sin psicólogos activos), cuando se abre Hoy, entonces aparece en «detección sin derivación». | Automatizable (SQL) |
| CA-009-03 | Dada la ficha de un participante con 6 semanas, cuando se abre, entonces el calendario muestra 30 celdas L–V con el estado correcto y la serie diaria coincide con `respuestas_items`. | Manual con datos de demostración |
| CA-009-04 | Dado un participante con nowcast registrado el jueves y OLBI alto el viernes, cuando se abre la sección Modelo de su ficha, entonces la predicción aparece como acierto con su probabilidad y versión. | Automatizable (SQL sobre `predicciones_participante`) |
| CA-009-05 | Dado cualquier rol distinto de investigador, cuando consulta `bandeja_investigador`, `predicciones_participante` o `desempeno_modelo` por API, entonces recibe 0 filas. | Verificado por API con token real |
| CA-009-06 | Dado el investigador, cuando consulta `informes` por API, entonces no recibe `contenido_borrador` ni `contenido_aprobado`. | Verificado por API con token real |
| CA-009-07 | Dada una exportación, cuando termina, entonces existe un evento `exportacion_dataset` cuyo hash coincide con el `manifest.json` descargado. | Manual |
| CA-009-08 | Dado el filtro global empresa = X, cuando se navega entre Resumen, Cohorte y Participantes, entonces el filtro se mantiene y está en la URL. | Manual |
| CA-009-09 | Dada la calibración con n < 20 en un decil, cuando se muestra, entonces el punto lleva su n y se marca como poco fiable, sin ocultarse. | Manual |

## 8. Trazabilidad

| Requisito | Implementado en |
|---|---|
| §6 (vistas y funciones) | `supabase/migrations/20260919120000_panel_investigador.sql`: `serie_diaria_v2`, `calendario_respuestas`, `olbi_semanal_etiquetado`, `predicciones_participante`, `predicciones_evaluables`, `desempeno_modelo`, `calibracion_modelo`, `roc_auc_modelo()`, `cohorte_semanal`, `circuito_apoyo`, `bandeja_investigador`, `linea_tiempo_participante`, `ficha_participante()`, `cerrar_seguimiento()`, `reasignar_derivacion()`, `registrar_exportacion()` |
| RN-009-09 | `serie_diaria_v2` reemplaza a `historial_checkin`, retirada en `20260924140000_retirar_vistas_sin_uso.sql` |
| §6 (complemento) | `20260919130000_panel_participantes_v2.sql` (`panel_participantes_v2`, `exportaciones_registradas`), `20260919140000_investigador_identidad_y_modelo.sql` (`obtener_identidad` para investigador, RLS de `modelo_versiones`, trigger `solo_activa_y_visibilidad`) |
| RF-009-01 … 03 (Hoy) | `app/investigador/hoy.tsx`; badge y grupos en `modules/panel/SidebarInvestigador.tsx`; datos en `modules/investigador/panel.ts` (`bandeja`) |
| RF-009-05 (Cohorte) | `app/investigador/cohorte.tsx` sobre `cohorte_semanal` |
| RF-009-06 (filtro global, ⌘K) | `modules/investigador/filtro.tsx` (`useFiltro`, `conFiltro`: la URL es la fuente de verdad), buscador en `SidebarInvestigador.tsx` |
| RF-009-07 (tabla) | `app/investigador/participantes.tsx` sobre `panel_participantes_v2` |
| RF-009-08 (ficha) | `app/investigador/participante/[id].tsx`: calendario, serie diaria, trayectoria OLBI, predicciones confrontadas, ítem a ítem, línea de tiempo |
| RF-009-09 (acciones de la ficha) | mismo archivo: exportar ficha (JSON + CSV), `verIdentidad` (RF-006-12, evento `acceso_identidad` con `por='investigador'`), `reasignarDerivacion`, `cerrarSeguimiento` |
| RF-009-11 (versiones) | `app/investigador/versiones.tsx`; `activarVersion` en `panel.ts` |
| RF-009-12 (desempeño) | `app/investigador/desempeno.tsx`: matriz 2×2, precisión/recall/especificidad con IC de Wilson, ROC-AUC (`roc_auc_modelo`), curva por semana, calibración por deciles con n (CA-009-09), Brier sobre `predicciones_evaluables`, comparativa de versiones |
| RF-009-13, RN-009-06 (exportación) | `app/investigador/exportacion.tsx` + `modules/investigador/exportar.ts`: ZIP con CSV o JSON por tabla, `diccionario.md`, `manifest.json` (SHA-256), registro previo con `registrar_exportacion`, comprobante por evento. Parquet no disponible en el navegador (§9.3) |
| RF-009-04 (Resumen) | `app/investigador/index.tsx`: tres indicadores con fórmula visible (`adherencia`, `cohorte_semanal`, `circuito_apoyo`), cohorte por semana, adherencia por empresa, embudo del circuito, modelo activo por tarea, distribución del último OLBI |
| RF-009-10 (Derivaciones) | `app/investigador/derivaciones.tsx`: tramos detección → derivación → cita confirmada → 1ª sesión → informe con medianas y fuera de rango, vista por caso y por psicólogo, citas por estado (`citas_estudio`), asignación/reasignación. Migración `20260920100000_investigador_circuito_maestros.sql` añade `cita_confirmada_en`, `dias_a_cita`, `dias_cita_a_sesion` a `circuito_apoyo` |
| RF-009-14 (Auditoría) | `app/investigador/auditoria.tsx`: accesos a identidad con filtros por operador, código y revisión; fila en tierra si no había derivación abierta; exportación CSV; bitácoras de exportaciones y versiones |
| RF-009-15 (Maestros) | `app/investigador/empresa/[id].tsx`: ficha de empresa (participantes por código con estado, semana, adherencia, último OLBI y derivación; inscribir, restablecer, dar de baja; administradores). `app/investigador/empresas.tsx`: edición de `umbrales_empresa` vía `actualizar_umbrales_empresa()` con vista previa por empresa; `app/investigador/psicologos.tsx`: `desactivar_psicologo()` reasigna los casos abiertos antes de desactivar (ESP-008 §9.3), `reactivar_psicologo()` |
| Rendimiento | `20260920110000_panel_participantes_v2_materializada.sql`: las CTE de `panel_participantes_v2` se materializan (de 3–4 s con filtro por empresa a < 1 s; antes había timeouts de 8 s bajo carga) |
| Datos de demostración | `supabase/semilla_demo_empresa.sql` añade predicciones retrospectivas (nowcast del jueves y pronóstico del viernes) calculadas con las versiones activas sobre los rasgos reales de cada semana, para que Desempeño y la sección Modelo de la ficha tengan con qué verse |

## 9. Decisiones abiertas

1. **Umbrales de la bandeja y límites del circuito** (4 días inactivo, 7 días sin sesión, 2 días cita sin confirmar; tramos 1.0 / 2.0 / 7.0 / 5.0 días en Derivaciones): propuestos por sentido común; el asesor debería fijarlos según el protocolo de contacto (ESP-007 §9).
2. **Entrenar desde el panel.** Requiere un runner (Edge Function con Python no es viable; sería una acción de GitHub o un servicio aparte). Mientras tanto, el panel muestra el comando y el investigador lo corre localmente.
3. **Parquet en el navegador.** Decidido por ahora: CSV y JSON; Parquet aparece deshabilitado en la pantalla. Si la tesis lo necesita, se añade una librería WASM.
4. **¿El investigador ve el motivo escrito por el participante al pedir cita?** Propuesta: **no** (es para el psicólogo, RF-004-13); solo el hecho y el estado de la cita.
5. **Calibración con pocos datos.** Con < 100 predicciones los deciles son ruido; se muestran igual con su n (CA-009-09), pero conviene acordar desde qué n se reporta en la tesis.
6. **Ficha imprimible** para anexos de casos ilustrativos (anonimizados): ¿se incluye ahora o después de la defensa?
