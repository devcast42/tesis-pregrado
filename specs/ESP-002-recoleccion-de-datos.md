# ESP-002 · Recolección longitudinal de datos

| | |
|---|---|
| **Estado** | Implementada · revisión 2 (calendario semanal) **aplicada**; pendiente de la conformidad del asesor |
| **Módulo** | `modules/recoleccion` |
| **Depende de** | ESP-001 |
| **Diseño de la revisión 2** | [docs/diseno-semanal-con-preentrenamiento.md](../docs/diseno-semanal-con-preentrenamiento.md) |

## 1. Justificación en la tesis

Alimenta los tres indicadores del estudio y construye el dataset del modelo:

- **Indicador 2** — n.º de profesionales evaluados por unidad de tiempo
- **Indicador 3** — tiempo promedio de detección, calculado desde los eventos que este módulo registra
- **Fase 2 de CRISP-DM** — comprensión de los datos

La recolección longitudinal es irreversible: lo que no se capture el día 1 no existirá nunca para el día 1.

## 2. Propósito

Presentar al participante los instrumentos según el calendario semanal, capturar las respuestas ítem por ítem y registrar los eventos de proceso que alimentan los indicadores.

## 3. Fuera de alcance

- Cálculo de puntajes y clasificación → ESP-003
- Definición del contenido psicométrico del OLBI (proviene del Anexo 07 validado)
- Modelo predictivo → ESP-005

## 4. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-002-01 | La app muestra qué instrumentos están pendientes hoy según su cadencia |
| RF-002-02 | Los formularios se renderizan desde la definición almacenada en base de datos, no desde el código  La definición incluye además el texto que la anuncia (`titulo`, `descripcion`, `duracion`): la pantalla «Hoy» los lee de ahí y no los copia, para que no pueda prometer una duración distinta de la real. |
| RF-002-03 | Cada respuesta se guarda **ítem por ítem**; el puntaje agregado no se almacena |
| RF-002-04 | Se registra `evaluacion_iniciada` al abrir el formulario y `evaluacion_enviada` al enviarlo |
| RF-002-05 | No se permite enviar un formulario incompleto |
| RF-002-06 | Un recordatorio local avisa de lunes a viernes a una **hora y minuto** que el participante elige en Perfil (formato 24 h; por defecto 19:00). Los recordatorios se reprograman en cada apertura de la app (se pierden al reinstalar) y hay un botón «Probar ahora» que envía un aviso en 10 s. En Android se usa un canal propio de importancia alta y el permiso `USE_EXACT_ALARM`, para que el aviso llegue a la hora y no cuando el sistema quiera |
| RF-002-07 | El participante ve su **racha** de días hábiles consecutivos con el registro del día (check-in lunes–jueves, OLBI viernes) como pastilla en la barra de Hoy; el fin de semana no cuenta ni la rompe; hoy sin responder no la rompe todavía. Con 0 dice «Empieza hoy», nunca reprocha. Al tocarla, explica la regla y la mejor racha |
| RF-002-08 | Un formulario ya enviado hoy no se vuelve a solicitar el mismo día |
| RF-002-09 | El calendario de cada formulario (`dias`, `gracia_dias`) y de cada ítem (`dias`) vive en la definición; la app lo lee, no lo codifica |
| RF-002-10 | Los ítems marcados en `barajar` se presentan en orden aleatorio en cada apertura |
| RF-002-11 | Un formulario con `despues_de` se presenta a continuación del indicado, como una sola sesión de respuesta |
| RF-002-12 | Al cerrar la sesión del viernes, el participante ve su **nivel** por dimensión (bajo / a vigilar / alto), un mensaje y recomendaciones concretas; puede volver a verlo durante la semana siguiente. Al cerrar el check-in diario ve un agradecimiento y, si el día lo amerita, un consejo derivado de las horas trabajadas y dormidas |
| RF-002-13 | De lunes a jueves, el participante ve la **probabilidad** (ESP-005, nowcast) de que el cuestionario del viernes salga alto, **siempre acompañada de su nivel de confianza** (baja / media / alta) y de una explicación en palabras de cuántos avisos se confirman y cuántos casos detecta, según los días respondidos. Aparece en el modal de cierre y en la pantalla principal |
| RF-002-15 | La app del participante se organiza en tres pestañas inferiores: **Hoy** (lo que toca responder, resultado, sesión), **Apoyo** (cita con el psicólogo, ESP-004 RF-004-13) y **Perfil** (datos iniciales, recordatorio, huella, derechos, cerrar sesión). Formularios y videollamada se abren a pantalla completa, sin pestañas |
| RF-002-16 | Desde Perfil el participante ve sus **datos iniciales** (formulario `estable`) y puede actualizarlos respondiéndolo de nuevo; toda consulta que use `estable` (`ventanas_modelo`, `perfil_caso`) toma solo la última respuesta |
| RF-002-14 | El viernes, junto al resultado, el participante ve (a) la **retrospectiva**: qué probabilidad dio el modelo el último día antes del viernes y si acertó, y (b) el **pronóstico** para la próxima semana (ESP-005, tarea `pronostico`) con su confianza |

### Calendario semanal (revisión 2)

| Día ISO | Formulario | Contenido | Duración objetivo |
|---|---|---|---|
| — | `estable` | Una vez, al inscribirse | ~2 min |
| 1–4 (lun–jue) | `diario` | 4 ítems OLBI-diario (1–5) + horas trabajadas + horas dormidas + **bloque de recuperación** (desconexión 1–5 y si la contactaron fuera de horario); el lunes además horas trabajadas el fin de semana | ~35 s |
| 5 (viernes) | `olbi` → `semanal` | OLBI completo (16 ítems, 1–4) y a continuación 3 ítems de contexto de la semana | ~4 min |
| 6–7 | — | Nada. El fin de semana se pregunta el lunes | — |

El `olbi` y el `semanal` del viernes admiten **2 días de gracia** (sábado y domingo). El `diario` no: un día perdido es un hueco en la serie.

**Duración del seguimiento: 6 semanas** (propuesta; decisión abierta 1).

#### Los cuatro ítems diarios

Ítems del OLBI (Anexo 07) en presente, escala de cinco puntos, todos negativos, **los mismos todos los días en orden aleatorio**:

| Clave | Hoy… | Ítem OLBI |
|---|---|---|
| `od_04` | después del trabajo necesitaré más tiempo del habitual para relajarme y recuperarme | olbi_04 |
| `od_12` | termino el trabajo exhausto y fatigado | olbi_12 |
| `od_03` | hablé de mi trabajo de forma negativa | olbi_03 |
| `od_06` | trabajé casi mecánicamente, sin pensar mucho en lo que hacía | olbi_06 |

Son idénticos en redacción y escala a los del diario de Gruszczynska, Basinska y Schaufeli (2021), cuyos datos públicos preentrenan el modelo (ESP-005 §5). **Cambiar los ítems, la redacción o la escala rompe la transferencia.** No llevan `dimension` ni `invertido`: no son un instrumento, son entradas del modelo, y nadie ve un puntaje de ellos.

#### Cadencia anterior (revisión 1)

`diario` cada día · `semanal` cada 7 días · `olbi` cada 14 días. Queda en `agenda.ts` (`CADENCIA_DIAS`) solo como respaldo para una definición sin `dias`.

## 5. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-002-01 | Las respuestas son **append-only**: una corrección agrega fila, no sobrescribe | Preserva la trazabilidad del dato longitudinal. Sobrescribir destruye evidencia |
| RN-002-02 | Toda respuesta guarda `formulario_version` | Si un ítem cambia a mitad del estudio, las respuestas dejan de ser comparables sin saber qué versión respondió cada uno |
| RN-002-03 | `iniciado_en` se captura al **montar** la pantalla, no al enviar | Es la mitad del indicador de tiempo. Capturarlo al enviar lo haría siempre cero |
| RN-002-04 | El OLBI **completo no** se aplica a diario. Cuatro ítems en versión diaria, con precedente publicado, sí; y **nunca se puntúan** | El instrumento no está validado a diario y 16 ítems cada día producen deserción. Los cuatro ítems diarios son entradas del modelo, no una medición: puntuarlos crearía un «OLBI diario» sin respaldo |
| RN-002-06 | Los ítems diarios son los mismos todos los días; solo cambia el orden | Rotar ítems distintos por día hace que dos días no sean comparables (±0.50 puntos entre conjuntos el mismo día en los datos de referencia) y destruye la pendiente, que es la señal más temprana. Contra la inercia basta barajar |
| RN-002-07 | La parte compartida con el estudio de referencia (ítems `od_*`, escala 1–5, calendario lun–jue) no se modifica sin actualizar ESP-005 | Es la condición del preentrenamiento |
| RN-002-08 | La retroalimentación al participante muestra el **nivel del instrumento** (OLBI, calculado en el servidor) traducido a palabras y recomendaciones, y la **probabilidad del modelo solo junto a su confianza** (RF-002-13). Nunca la palabra «diagnóstico» ni el informe del psicólogo (RN-004-03). El nivel alto termina siempre en la oferta de la sesión de apoyo | Pedido del asesor: el estudio debe servirle a quien responde. Un número sin decir cuánto fiarse de él engaña; con su confianza al lado, es un pronóstico, como el del clima. Se declara en el consentimiento y, en métodos, la reactividad como limitación |
| RN-002-10 | La confianza sale de las métricas validadas de la versión activa para el número de días respondidos (ROC-AUC < 0.7 baja, < 0.8 media, ≥ 0.8 alta), **con tope «media» para versiones de origen `preentrenamiento`**, y la explicación redondea precisión y recall a «de cada 10» | La misma regla para cualquier versión: el modelo preentrenado sale «baja/media» y uno propio bien validado sube solo. Dos decimales aparentarían una exactitud que no existe |
| RN-002-11 | Qué roles ven la probabilidad lo decide `modelo_versiones.visible_para`, no la app | Retirar la probabilidad al participante, si el asesor o el comité lo piden, es cambiar una fila, no publicar una versión de la app |
| RN-002-09 | El consejo del check-in diario sale de las horas (trabajo, sueño, fin de semana), nunca de los ítems `od_*` | Los `od_*` no se puntúan (RN-002-04); un consejo derivado de ellos sería un puntaje encubierto |
| RN-002-05 | El cliente nunca calcula ni almacena un puntaje | La puntuación es competencia del servidor (ESP-003); un cliente no puede influir en una detección |

## 6. Contratos de datos

```
formularios                                   (clave, version) PK
  definicion: {
    titulo, descripcion?, items: ItemDef[],
    dias?: number[]          // días ISO (1 = lunes … 7 = domingo) en que corresponde
    gracia_dias?: number     // días después en que aún se acepta
    barajar?: true | string[]// todos los ítems, o solo esas claves
    despues_de?: clave       // se presenta a continuación de ese formulario
  }

ItemDef
  clave, texto, tipo: 'escala'|'numero'|'booleano'|'opcion'
  escala?    { min, max, etiquetaMin?, etiquetaMax? }
  opciones?  { valor, etiqueta }[]
  dias?      number[]          // solo se muestra esos días; sin él, siempre
  dimension? invertido?        // solo instrumentos psicométricos

respuestas                                    (append-only)
  id, participante_id, formulario_clave, formulario_version,
  iniciado_en, enviado_en

respuestas_items                              (append-only)
  respuesta_id, item_clave, valor_num, valor_texto

eventos                                       (append-only)
  participante_id, tipo, ocurrido_en, metadata
```

## 7. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-002-01 | Dado un formulario enviado, entonces existe una fila en `respuestas_items` por cada ítem de la definición | Prueba automatizada |
| CA-002-02 | Dado un formulario abierto y enviado 45 s después, entonces `enviado_en − iniciado_en ≈ 45 s` | Prueba automatizada |
| CA-002-03 | Dado un formulario con un ítem sin responder, cuando se intenta enviar, entonces se rechaza y se señala el ítem faltante | Manual |
| CA-002-04 | Dado un check-in ya enviado hoy, cuando se vuelve a la pantalla, entonces aparece como completado | Manual |
| CA-002-05 | Consultando la base de datos, no existe ninguna columna que almacene un puntaje agregado | Revisión de esquema |
| CA-002-06 | Dado un cambio en la definición del formulario, entonces las respuestas anteriores conservan su `formulario_version` original | Prueba automatizada |
| CA-002-07 | Dado un martes, entonces la agenda muestra `diario` sin el ítem `horas_fin_de_semana`; dado un lunes, lo muestra | Prueba automatizada |
| CA-002-08 | Dado un sábado con el `olbi` del viernes sin enviar, entonces la agenda lo ofrece; dado un lunes, ya no | Prueba automatizada |
| CA-002-09 | Dado un viernes, entonces `semanal` aparece solo después de enviar `olbi` | Manual |
| CA-002-10 | Dadas dos aperturas del `diario`, entonces los cuatro ítems `od_*` aparecen en orden distinto y los demás en el mismo | Prueba automatizada |
| CA-002-11 | Consultando la base de datos, ningún ítem `od_*` tiene `dimension` ni `invertido` | Revisión de esquema |
| CA-002-12 | Dado un OLBI enviado con medias de 2.5 en ambas dimensiones (umbrales 2.875 / 2.75), entonces la pantalla de resultado muestra «A vigilar» en ambas y no la derivación | Manual |
| CA-002-13 | Dado un OLBI que produce detección, entonces la pantalla de resultado muestra nivel «Alto» y el bloque de sesión de apoyo, y nunca un puntaje llamado «burnout» | Manual |
| CA-002-14 | Dado un check-in con `horas_sueno = 5`, entonces el cierre muestra el consejo de sueño; con 7 h y 8 h de trabajo, el mensaje de día equilibrado | Prueba automatizada sobre `consejoDelDia` |
| CA-002-15 | Dado un participante con 3 diarios esta semana y la versión `preentrenamiento-v1` activa, entonces el cierre muestra la probabilidad con «Confianza media» y la frase «de cada 10 avisos…»; sin diarios esta semana, no muestra probabilidad | Manual (verificado 2026-09-18) |
| CA-002-16 | Dado `visible_para` sin `participante`, entonces la app no muestra probabilidad aunque exista versión activa | Prueba automatizada sobre `probabilidad_semana` |
| CA-002-17 | Dado un OLBI del viernes con una predicción nowcast registrada el jueves (58 %) y resultado «A vigilar», entonces el modal dice «estimó 58 %… Salió no alto: esta vez se equivocó» y muestra el pronóstico con confianza «media» | Manual (verificado 2026-09-18) |

## 8. Trazabilidad

| Requisito | Implementado en |
|---|---|
| RF-002-01, RF-002-08 | `modules/recoleccion/agenda.ts`, `app/hoy.tsx` |
| RF-002-02 | `modules/recoleccion/datos.ts`, `modules/recoleccion/componentes/Campo.tsx` |
| RF-002-03, RF-002-04 | `modules/recoleccion/datos.ts` |
| RF-002-05 | `modules/recoleccion/componentes/Formulario.tsx` |
| RF-002-06 | `modules/recoleccion/recordatorios.ts` |
| RN-002-01, RN-002-02 | `supabase/migrations/20260829090100_esquema_inicial.sql` |
| Calendario semanal, RN-002-04, RN-002-06, RN-002-07 | `supabase/migrations/20260918100000_formularios_calendario_semanal.sql` |
| RF-002-09 | `modules/recoleccion/agenda.ts` (`vencimientoVigente`), `modules/recoleccion/datos.ts` (`calendarios`), `componentes/Formulario.tsx` (`itemsDeHoy`) |
| RF-002-10 | `modules/recoleccion/componentes/Formulario.tsx` (`itemsDeHoy`) |
| RF-002-11 | `modules/recoleccion/agenda.ts` (`despues_de`), `app/formulario/[clave].tsx` (`siguienteEncadenado`) |
| RF-002-06 (rev. 2: lunes a viernes, hora:minuto, canal, prueba, resincronización) | `modules/recoleccion/recordatorios.ts` (`horaRecordatorio`, `guardarHoraRecordatorio`, `sincronizarRecordatorios`, `probarRecordatorio`), `app/(participante)/perfil.tsx`, `app/(participante)/hoy.tsx`, `app.json` (`USE_EXACT_ALARM`) |
| RF-002-12, RN-002-08, RN-002-09 | `modules/participante/resultado.ts` (niveles, textos, consejo), `modules/participante/ModalResultado.tsx` (modal sobre la pantalla principal), `app/formulario/[clave].tsx` (encadenado al cierre), `app/hoy.tsx` (tarjeta «Tu resultado del viernes») |
| RF-002-13, RN-002-10 | `modules/participante/resultado.ts` (`confianzaDe`, `explicacionConfianza`), `ModalResultado.tsx` (`Probabilidad`), `modules/recoleccion/datos.ts` (`prediccionActual`) |
| RF-002-14 | `modules/participante/resultado.ts` (`fraseRetrospectiva`), `modules/recoleccion/datos.ts` (`ultimaPrediccionSemana`), `app/formulario/[clave].tsx`, `supabase/migrations/20260918150000_modelo_pronostico.sql` |
| RN-002-11 | `supabase/migrations/20260918120000_modelo_versiones.sql` (`visible_para`, `probabilidad_semana`) |
| RF-002-07 | `supabase/migrations/20260918210000_racha.sql` (`racha`, `dia_habil_anterior/siguiente`), `modules/recoleccion/datos.ts` (`racha`), `modules/participante/piezas.tsx` (`PastillaRacha`), `app/(participante)/hoy.tsx` |
| RF-002-15 | `app/(participante)/_layout.tsx`, `app/(participante)/hoy.tsx`, `app/(participante)/apoyo.tsx`, `app/(participante)/perfil.tsx` |
| RF-002-16 | `modules/recoleccion/datos.ts` (`datosIniciales`), `app/(participante)/perfil.tsx`, `supabase/migrations/20260918190000_estable_ultima_respuesta.sql` |

## 9. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| 1 | Aprobar el calendario semanal y las **6 semanas** de seguimiento (reemplaza «duración en días») | Asesor |
| 2 | Aprobar los cuatro ítems diarios y su escala 1–5 (§4) | Asesor |
| 3 | Contenido definitivo de `estable` | Autores + asesor |
| 4 | Hora por defecto del recordatorio diario, y hora del recordatorio del viernes | Autores |
| 5 | Actualizar el texto del consentimiento informado (ESP-001): el participante recibe retroalimentación semanal sobre su nivel y recomendaciones | Autores + asesor |
| 6 | Los textos de `MENSAJE_GENERAL` y `RECOMENDACIONES` los revisa un psicólogo antes de recolectar | Asesor |
