# ESP-008 · Maestros y administración de empresas

| | |
|---|---|
| **Estado** | Implementada (rev. 1 y rev. 2 · panel del empresario) · umbrales y mínimos pendientes de validación del asesor (§9) |
| **Módulo** | `modules/panel` |
| **Depende de** | ESP-006 (roles y permisos), ESP-001 (acceso) |

## 1. Justificación en la tesis

El estudio se aplica en varias empresas de tecnología hasta completar la
muestra. Sin un lugar donde dar de alta empresas y cuentas, cada inscripción
exige tocar la base de datos a mano: un cuello de botella que no escala a
varias empresas y que no deja rastro auditable de quién dio de alta a quién.

Además, ninguna empresa entrega a sus trabajadores a un estudio externo sin
alguien de su lado que administre las cuentas. Ese alguien es el rol `admin`.
La tensión que resuelve esta especificación es que esa persona necesita
gestionar cuentas **sin** enterarse del estado de salud de sus compañeros.

## 2. Propósito

Definir los maestros del sistema —empresas, administradores, psicólogos y
participantes—, quién administra cada uno y, sobre todo, qué ve y qué no ve el
administrador de una empresa.

**Rev. 2** amplía el rol `admin` de «quien administra cuentas» a «quien recibe
inteligencia organizacional». La pregunta de diseño es qué puede saber una
empresa **sin saber nada de nadie**. La respuesta que sostiene la tesis y el
consentimiento: indicadores agregados y accionables sobre la organización —cómo
está, qué la desgasta y qué puede cambiar— nunca sobre personas. No es una
limitación disfrazada: es lo que hace que la gente responda. Sin la garantía
de que el empleador no podrá señalar a nadie, no hay dato que valga.

## 3. Fuera de alcance

- **Equipo de investigación como maestro.** Hay un solo investigador; darlo de
  alta se hace en la base.
- **Baja de psicólogos con casos abiertos.** Requiere reasignar derivaciones;
  se hace en la base hasta que exista el flujo de reasignación.
- **Edición del nombre de una empresa.** Se crea y se usa; renombrar es un caso
  raro que no justifica el código.
- **Jerarquía de administradores.** Todos los admins de una empresa son
  equivalentes.

## 4. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-008-01 | El investigador debe poder crear empresas y listarlas. |
| RF-008-02 | El investigador debe poder crear administradores dentro de una empresa concreta. |
| RF-008-03 | El investigador debe poder crear psicólogos, que pertenecen al estudio y no a una empresa. |
| RF-008-04 | El investigador debe poder inscribir participantes en cualquier empresa. |
| RF-008-05 | El admin debe poder inscribir participantes **solo** en su propia empresa. |
| RF-008-06 | El admin debe poder restablecer la contraseña de los participantes de su empresa. |
| RF-008-07 | El investigador debe poder restablecer la contraseña de cualquier cuenta del estudio. |
| RF-008-08 | Toda alta de cuenta debe devolver la contraseña generada una sola vez, en pantalla. |
| RF-008-09 | El admin debe ver, de su empresa: inscritos, quiénes consintieron, cuántos siguen en seguimiento y días sin responder por persona. |
| RF-008-10 | El admin debe ver cifras agregadas de adherencia de su empresa solo si hay al menos 10 participantes inscritos. |
| RF-008-11 | El investigador debe poder consultar el registro de accesos a identidad. |
| RF-008-12 | El investigador debe poder consultar todas las derivaciones y su tiempo de cierre. |

**Rev. 2 — panel del empresario**

| ID | Requisito |
|---|---|
| RF-008-13 | **Pulso semanal.** El admin ve, por semana del estudio, el promedio del OLBI de su empresa en cada dimensión (agotamiento, desvinculación) en una tendencia de las últimas 6 semanas, con un nivel organizacional (bajo / a vigilar / alto) definido por umbrales **de empresa**, distintos de los individuales (ESP-003). |
| RF-008-14 | **Comparación con el estudio.** Junto a cada cifra de la empresa se muestra el promedio de las demás empresas del estudio esa misma semana, sin nombrarlas, y solo si ese conjunto también cumple el mínimo de reporte. |
| RF-008-15 | **Factores de trabajo (JD-R).** Por semana: horas trabajadas/día (media), horas de sueño (media), horas trabajadas el fin de semana (media), sobretiempo semanal (media), % con guardia, apoyo del líder (media 1–5). Cada factor con tendencia y un valor de referencia. |
| RF-008-16 | **Qué se mueve con qué.** Para cada factor, la correlación con el agotamiento de la empresa a lo largo de las semanas reportables; se muestra en palabras («las semanas con más fin de semana trabajado son las de mayor agotamiento») solo cuando hay ≥ 6 semanas y la relación es clara (|r| ≥ 0.4). |
| RF-008-17 | **Segmentos.** Pulso y factores se pueden ver por modalidad (remoto / híbrido / presencial) y por rol, únicamente para segmentos con al menos `minimo_para_reportar()` respondientes esa semana; los demás segmentos se ocultan, no se muestran «sin datos». |
| RF-008-18 | **Recomendaciones organizacionales.** Reglas sobre los factores agregados (§6) producen recomendaciones para la empresa con una referencia bibliográfica corta. Nunca nombran a personas ni a segmentos ocultos. |
| RF-008-19 | **Participación.** Inscritos, consintieron, en seguimiento, tasa de respuesta semanal (respondieron el viernes / en seguimiento) y tendencia; recordatorio a inactivos lo envía el sistema (ESP-007), no el admin. |
| RF-008-20 | **Gestión de cuentas** (ya existente, integrada): inscribir, reenviar credenciales, y **dar de baja** cuando la persona deja la empresa (`finalizado`, con motivo administrativo; nunca revela ni toca el estado clínico). |
| RF-008-21 | **Uso del apoyo psicológico**, agregado por mes: número de sesiones realizadas, solo si ≥ `minimo_para_reportar()`/2 sesiones y redondeado a múltiplos de 5 («unas 5», «unas 10»). Nunca quién ni cuándo. |
| RF-008-22 | **Informe mensual** descargable (PDF/impresión del navegador): pulso, factores, recomendaciones, participación y uso del apoyo; una página, con la leyenda de agregación y el mínimo de reporte al pie. |
| RF-008-23 | Todo lo anterior sale de vistas SECURITY DEFINER propias del admin que aplican el mínimo de reporte **dentro de la vista** (RN-008-03); la app no recibe filas que no pueda mostrar. |

## 5. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-008-01 | El admin no accede a respuestas, puntajes, detecciones, derivaciones, sesiones ni informes. | Es el empleador. Que sepa quién dio positivo en burnout expone a la persona justo ante quien decide su continuidad laboral. |
| RN-008-02 | El admin ve un único booleano `en_seguimiento`; nunca el estado real del participante. | `detectado`, `retirado` y `finalizado` deben ser indistinguibles: si solo desapareciera el detectado, la ausencia misma sería el diagnóstico. |
| RN-008-03 | Las vistas del admin son SECURITY DEFINER y son su **único** camino a los datos; no tiene lectura directa sobre `participantes`, `identidades` ni `consentimientos`. | Curar una vista no sirve de nada si la tabla de abajo sigue siendo legible: `select estado from participantes` devolvía `detectado`. La vista tiene que ser la frontera, no una comodidad. |
| RN-008-04 | Ninguna cifra agregada por empresa se reporta con menos de 10 inscritos (`minimo_para_reportar()`). | En un grupo de cuatro, "el 25% lleva cuatro días sin responder" nombra a una persona. |
| RN-008-05 | El admin ve nombres y correos de su empresa, y ese acceso **no** se audita uno por uno. | Él mismo inscribió a esas personas: son sus compañeros, no le revelamos una identidad que no tuviera. Distinto es el psicólogo (ESP-006 RN-006-03), donde la revelación es excepcional y clínica. |
| RN-008-06 | El investigador **no** ve nombres de participantes en ninguna pantalla. | RN-006-01: trabaja con códigos anónimos. Que el admin sí los vea no es una excepción a esa regla, es que administra cuentas, no datos de investigación. |
| RN-008-07 | Los psicólogos pertenecen al estudio, no a una empresa, y solo el investigador los administra. | Un mismo profesional atiende casos de varias empresas; y que un empleador elija al psicólogo que atenderá a su empleado es un conflicto de interés. |
| RN-008-08 | El alcance de cada quien se verifica contra la base con el JWT del solicitante, nunca contra lo que diga la petición. | El `organizacion_id` del cuerpo es un dato del cliente; el rol y la empresa se leen del servidor. |
| RN-008-09 | Toda consulta de "lo mío" filtra explícitamente por `auth_user_id`, aunque RLS ya acote la tabla. | RLS acota lo que un rol *puede* ver, no lo que una consulta *debe* devolver: el investigador lee toda `usuarios_rol`, así que un `maybeSingle()` sin filtro le devolvía varias filas y lo dejaba sin rol. |

**Rev. 2**

| ID | Regla | Motivo |
|---|---|---|
| RN-008-10 | El admin **nunca** ve un dato individual de salud o de respuesta: ni puntajes por código, ni probabilidad del modelo por persona, ni «quién está en riesgo», ni la lista de derivados. Tampoco el promedio de un grupo menor al mínimo. | Es el empleador. Un promedio de cuatro personas es una persona. |
| RN-008-11 | El mínimo de reporte se aplica por **celda** (empresa × semana × segmento), no solo por empresa. Una celda bajo el mínimo se omite; no se muestra «n/d» ni «sin datos», para que la ausencia no informe. | Si el segmento «presencial» desaparece justo la semana que dos personas lo dejaron, la ausencia señala. Omitir siempre lo pequeño hace la ausencia inocua. |
| RN-008-12 | Las cifras agregadas se redondean (OLBI a un decimal, porcentajes a múltiplos de 5, conteos de sesiones a múltiplos de 5). | Reduce la posibilidad de reconstruir respuestas individuales comparando semanas consecutivas (ataque por diferencia). |
| RN-008-13 | Los umbrales organizacionales del pulso son distintos de los individuales de ESP-003 y los fija el investigador (`umbrales_empresa`); el admin no puede cambiarlos. | Un promedio de 2.5 en un grupo no significa lo mismo que 2.5 en una persona; y el umbral que decide «alto» para una empresa no puede estar en manos de la empresa. |
| RN-008-14 | La comparación con «el estudio» excluye a la propia empresa y exige que el resto también cumpla el mínimo; nunca se desglosa por empresa. | Con dos empresas, «las demás» es una: se estaría mostrando el dato de un competidor. |
| RN-008-15 | Las recomendaciones son reglas declaradas en el código, revisables, con su umbral y su referencia; no se generan con un modelo de lenguaje. | Un empresario va a tomar decisiones con esto; tiene que poder leer por qué se le dice lo que se le dice. |
| RN-008-16 | Dar de baja por salida de la empresa marca `finalizado` con `motivo = 'salida_empresa'`, conserva las respuestas anonimizadas (RN-001-03) y **no** cierra derivaciones abiertas: el psicólogo termina su caso aunque la persona ya no esté en la empresa. | Retirar el apoyo psicológico el día que alguien es despedido sería lo contrario de lo que promete el estudio. |
| RN-008-17 | El admin no cruza el panel con ningún dato de RR.HH. (ausencias, desempeño, sueldos); el sistema no ofrece exportación individual ni API para hacerlo. | El consentimiento cubre investigación y apoyo, no gestión de personal. |

## 6. Contratos de datos

**Tablas**

- `organizaciones (id, nombre, creado_en)`
- `usuarios_rol (auth_user_id, rol, organizacion_id)` — `organizacion_id` es
  obligatorio para `admin` y nulo para el resto (restricción
  `admin_pertenece_a_empresa`).
- `administradores (id, auth_user_id, organizacion_id, nombre, activo)`
- `psicologos (id, auth_user_id, nombre, colegiatura, activo)`

**Vistas del admin** (SECURITY DEFINER, filtradas por `alcance_empresa()`)

- `participacion_empresa (participante_id, organizacion_id, codigo_anonimo,
  nombre, correo_contacto, inscrito_en, consentimiento, en_seguimiento,
  dias_sin_responder)`
- `resumen_empresa (organizacion_id, nombre, inscritos, en_seguimiento,
  consintieron, respondieron_ayer, sin_responder_4d, reportable)`

**Vistas del panel del empresario (rev. 2)** — SECURITY DEFINER, filtradas por
`alcance_empresa()`, mínimo de reporte aplicado dentro. Semana = lunes de la
semana en `tz_estudio()`.

- `pulso_empresa (organizacion_id, semana, respondientes, agotamiento_media,
  desvinculacion_media, nivel_agotamiento, nivel_desvinculacion)` — solo
  filas con `respondientes ≥ minimo_para_reportar()`.
- `pulso_estudio (semana, empresas, respondientes, agotamiento_media,
  desvinculacion_media)` — todas las empresas **menos la del solicitante**;
  fila solo si `empresas ≥ 2` y `respondientes ≥ minimo_para_reportar()`.
- `factores_empresa (organizacion_id, semana, respondientes, horas_dia_media,
  sueno_media, fin_de_semana_media, sobretiempo_media, guardia_pct,
  apoyo_lider_media)` — mismo mínimo; `guardia_pct` redondeado a 5.
- `pulso_empresa_segmento (organizacion_id, semana, tipo_segmento
  ('modalidad'|'rol'), segmento, respondientes, agotamiento_media,
  desvinculacion_media)` — celdas bajo el mínimo omitidas.
- `factores_empresa_segmento (… idem …)`.
- `apoyo_empresa_mensual (organizacion_id, mes, sesiones_aprox)` — fila solo
  si `sesiones ≥ minimo_para_reportar()/2`; `sesiones_aprox` redondeado a 5.
- `participacion_empresa_semanal (organizacion_id, semana, en_seguimiento,
  respondieron_viernes, tasa_respuesta_pct)`.
- `umbrales_empresa (dimension, a_vigilar, alto)` — tabla del investigador,
  legible por el admin.

**Reglas de recomendación (rev. 2)** — en `modules/panel/recomendaciones.ts`,
cada una con `{ id, condicion, texto, referencia }`. Primer conjunto:

| ID | Condición (semana más reciente reportable) | Recomendación |
|---|---|---|
| REC-01 | `horas_dia_media ≥ 9.5` | Revisar la carga: la jornada media supera las 9.5 h. Considerar límites de sobretiempo y redistribución. (Demerouti et al., 2001) |
| REC-02 | `fin_de_semana_media ≥ 3` o `sobretiempo_media ≥ 5` | Política de desconexión: el trabajo fuera de horario es el mayor predictor de agotamiento en el modelo JD-R. |
| REC-03 | `guardia_pct ≥ 40` | Rotar guardias y compensar con descanso; más del 40 % estuvo disponible fuera de horario. |
| REC-04 | `sueno_media < 6.5` | El sueño promedio está bajo 6.5 h: revisar horarios de inicio y guardias nocturnas. |
| REC-05 | `apoyo_lider_media < 3` | Fortalecer el liderazgo de primera línea: el apoyo del líder es el recurso con mayor efecto protector. (Bakker & Demerouti, 2007) |
| REC-06 | `nivel_agotamiento = 'alto'` dos semanas seguidas | Agotamiento organizacional sostenido: conversar con el equipo de investigación sobre una intervención. |
| REC-07 | `tasa_respuesta_pct < 60` | Participación baja: la lectura es poco fiable. Recordar en reunión de equipo que las respuestas son anónimas. |

**Funciones de alcance**

- `es_admin()`, `empresa_del_admin()`, `alcance_empresa(organizacion_id)`
- `minimo_para_reportar() → 10`

**Edge Functions** (todas verifican el rol con `rolDelSolicitante(req)`)

- `crear-admin { organizacion_id, correo, nombre } → { correo, contrasena }`
- `crear-psicologo { correo, nombre, colegiatura } → { correo, contrasena }`
- `inscribir-participante { organizacion_id, correo, nombre } → { codigo_anonimo, contrasena }`
- `restablecer-contrasena { auth_user_id | participante_id } → { contrasena }`

## 7. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-008-01 | Dado un admin autenticado, cuando consulta `participantes`, `identidades`, `respuestas`, `eventos`, `derivaciones`, `informes` o `puntajes_olbi` por API, entonces recibe 0 filas. | Verificado por API con token real |
| CA-008-02 | Dado un admin, cuando consulta `participacion_empresa`, entonces recibe solo su empresa y ninguna columna revela `estado`. | Verificado por API con token real |
| CA-008-03 | Dado un admin, cuando intenta inscribir en otra empresa, crear un admin o un psicólogo, o restablecer una clave ajena, entonces recibe 403. | Verificado por API con token real |
| CA-008-04 | Dada una empresa con menos de 10 inscritos, cuando el admin abre su panel, entonces no se muestran cifras de adherencia y se explica por qué. | Manual |
| CA-008-05 | Dado el investigador, cuando abre el detalle de una empresa, entonces no aparece ningún nombre de participante. | Manual |
| CA-008-06 | Dado el investigador, cuando crea una empresa, un admin, un psicólogo o inscribe un participante, entonces la contraseña generada se muestra una vez. | Manual |
| CA-008-07 | Dado un admin cuya empresa tiene 9 respondientes una semana y 12 la siguiente, cuando consulta `pulso_empresa`, entonces recibe solo la segunda semana. | Automatizable (SQL) |
| CA-008-08 | Dado un admin, cuando consulta `pulso_empresa_segmento`, entonces ninguna fila tiene `respondientes < minimo_para_reportar()` y no existe ninguna fila con medias nulas. | Automatizable (SQL) |
| CA-008-09 | Dado un estudio con una sola empresa reportable, cuando el admin consulta `pulso_estudio`, entonces recibe 0 filas. | Automatizable (SQL) |
| CA-008-10 | Dado un admin, cuando consulta por API `puntajes_olbi`, `modelo_versiones`, `casos_psicologo`, `citas` o `sesiones_consulta`, entonces recibe 0 filas. | Verificado por API con token real |
| CA-008-11 | Dado un admin que da de baja a un participante con derivación abierta, cuando el psicólogo abre su lista, entonces el caso sigue ahí y la identidad sigue accesible. | Manual |
| CA-008-12 | Dado el panel con datos, cuando se imprime el informe mensual, entonces cabe en una página y lleva al pie la leyenda del mínimo de reporte. | Manual |

## 8. Trazabilidad

| Requisito | Implementado en |
|---|---|
| RF-008-01 | `app/investigador/empresas.tsx`, `modules/panel/datos.ts` |
| RF-008-02 | `app/investigador/empresa/[id].tsx`, `supabase/functions/crear-admin` |
| RF-008-03 | `app/investigador/psicologos.tsx`, `supabase/functions/crear-psicologo` |
| RF-008-04, RF-008-05 | `supabase/functions/inscribir-participante` |
| RF-008-06, RF-008-07 | `supabase/functions/restablecer-contrasena` |
| RF-008-08 | `modules/panel/Tabla.tsx` (`Credenciales`) |
| RF-008-09, RF-008-10 | `app/admin/index.tsx`, `app/admin/participantes.tsx` |
| RF-008-11 | `app/investigador/auditoria.tsx` |
| RF-008-12 | `app/investigador/derivaciones.tsx` |
| RN-008-01 … RN-008-05 | `supabase/migrations/20260904100100_admin_empresa.sql`, `20260904100200_vistas_admin.sql`, `20260904110000_admin_sin_estado.sql` |
| RN-008-08 | `supabase/functions/_compartido/supabase.ts` (`rolDelSolicitante`) |
| RN-008-09 | `modules/nucleo/supabase.ts` (`idUsuario`), `modules/nucleo/rol.ts` |
| RF-008-13 … RF-008-23, RN-008-10 … RN-008-17 | `supabase/migrations/20260919100000_panel_empresario.sql` (vistas §6, `umbrales_empresa`, `dar_de_baja_participante`), `20260919110000_puntajes_olbi_interno.sql` (copia definer de la fórmula OLBI: la vista invoker devolvía vacío dentro de la cadena definer), `modules/panel/empresario.ts` (consultas, `FACTORES`, `relaciones`, `recomendaciones` REC-01…07), `modules/panel/PiezasEmpresario.tsx`, `modules/panel/Grafica.tsx` (bandas, series punteadas), `modules/panel/Sidebar.tsx`, `app/admin/{index,pulso,factores,participantes,informe}.tsx`. Datos de demostración: `supabase/semilla_demo_empresa.sql` |

## 9. Decisiones abiertas

1. **Mínimo de reporte = 10.** Elegido por convención de k-anonimato; debería
   confirmarlo el asesor a la luz del tamaño real de las empresas
   participantes. Cambia en un solo sitio: `minimo_para_reportar()`.
2. **¿El admin debería poder dar de baja a un participante?** Hoy no puede.
   Retirarse del estudio es una decisión del participante (ESP-001), pero falta
   resolver qué pasa cuando alguien deja la empresa.
3. **Reasignación de casos** al dar de baja a un psicólogo.

**Rev. 2 — para el asesor antes de construir**

4. **Umbrales organizacionales** (`umbrales_empresa`): propuesta inicial, media
   de la empresa ≥ 2.25 «a vigilar» y ≥ 2.85 «alto» en agotamiento (≥ 2.10 y
   ≥ 2.60 en desvinculación), tomados de los puntos de corte de Peterson et
   al. (2008) para el OLBI, que no fueron pensados para promedios grupales.
   Alternativa: percentiles del propio estudio una vez haya datos.
5. **Comparación con el estudio (RF-008-14).** Con dos empresas «las demás» es
   una. ¿Se activa solo desde tres empresas reportables, o se omite del piloto?
6. **Mínimo de reporte por segmento.** Con 10 por celda, en una empresa de 25
   casi ningún segmento se verá. ¿Mantener 10 (más seguro) o bajar a 7 en
   segmentos (más útil)? Cambia en `minimo_para_reportar()` o en una segunda
   función `minimo_segmento()`.
7. **Recomendaciones.** Los umbrales de REC-01…07 son de sentido común, no de
   literatura; pedir al asesor referencias para cada uno o dejarlas como
   «orientativas» en el texto.
8. **Baja por salida de la empresa (RF-008-20).** Hay que decir en el
   consentimiento que la empresa puede dar de baja la cuenta cuando la persona
   deja de trabajar ahí, y que sus respuestas se conservan anonimizadas.
9. **Informe mensual.** ¿Lo genera el admin cuando quiera, o lo emite el
   sistema el primer día hábil del mes y queda como registro inmutable? Lo
   segundo evita «informes a medida».
