# ESP-006 · Roles y permisos

| | |
|---|---|
| **Estado** | Borrador |
| **Módulo** | `supabase/migrations`, panel web (pendiente) |
| **Depende de** | ESP-001, ESP-003 |

## 1. Justificación en la tesis

Las Consideraciones Éticas exigen **confidencialidad** y **anonimización por códigos**. Con tres actores distintos y varias empresas participando, la confidencialidad deja de ser una promesa y pasa a ser una restricción que el sistema debe imponer: quién puede ver qué, y bajo qué condición se revela una identidad.

El indicador 2 (volumen evaluado) y el indicador 3 (tiempo de detección) se consultan desde el panel del investigador, por lo que este rol es también el instrumento de medición del estudio.

## 2. Propósito

Definir los tres roles del sistema, qué puede ver y hacer cada uno, y el momento controlado en que la identidad de un participante deja de estar anonimizada.

## 3. Fuera de alcance

- La videoconsulta en sí → ESP-004
- La generación del informe de apoyo → ESP-004
- Un eventual rol para la empresa participante → §9, decisión abierta 1

## 4. Roles

| Rol | Quién | Plataforma |
|---|---|---|
| `participante` | Profesional del sector tecnológico inscrito | App móvil |
| `psicologo` | Profesional de psicología que atiende derivaciones | App móvil, enrutada por rol |
| `investigador` | Equipo de tesis | Panel web aparte |

**Por qué el psicólogo comparte la app móvil.** Su flujo real es recibir la derivación, revisar el caso, atender la sesión y confirmar el informe. Necesita notificación push para enterarse de una derivación —por correo se pierde—, y la videollamada se integra en la app de todos modos. Un panel web separado duplicaría autenticación, despliegue e integración de LiveKit sin ganancia. Para el trabajo de escritorio, la misma base de código compila a web.

**Por qué el investigador no.** Exportar datasets, cruzar tablas y calcular los indicadores del estudio es otra herramienta, no otra pantalla de la misma app.

## 5. Requisitos funcionales

### Participante

| ID | Requisito |
|---|---|
| RF-006-01 | Ve y modifica únicamente sus propios datos (ya cubierto por ESP-001 y ESP-002) |

### Psicólogo

| ID | Requisito |
|---|---|
| RF-006-02 | Ve únicamente los participantes que le fueron **derivados explícitamente** |
| RF-006-03 | Para un participante derivado, ve su identidad, la trayectoria de puntajes y el evento de detección |
| RF-006-04 | No accede a respuestas ítem por ítem de instrumentos distintos al OLBI |
| RF-006-05 | Registra la realización de la sesión y sus observaciones |
| RF-006-06 | Pierde el acceso cuando la derivación se cierra |
| RF-006-13 | Tras autenticarse, la app dirige al participante o al psicólogo según el rol leído del servidor, sin selector manual |
| RF-006-14 | Recibe notificación push al abrirse una derivación a su nombre |

### Investigador

| ID | Requisito |
|---|---|
| RF-006-07 | Inscribe participantes y les asigna código anónimo |
| RF-006-08 | Consulta datos de investigación de **todas** las organizaciones, siempre anonimizados |
| RF-006-09 | Consulta los tres indicadores de la tesis |
| RF-006-10 | Exporta el dataset anonimizado para análisis en Jupyter |
| RF-006-11 | Gestiona psicólogos y derivaciones |
| RF-006-12 | Accede al mapeo identidad ↔ código solo mediante una acción explícita y registrada |
| RF-006-13 | La lista y la ficha del psicólogo salen de una sola vista (`casos_psicologo`): código, empresa, puntajes y umbrales de la detección, última sesión, estado del informe y estado del caso (`sesion_pendiente` / `sala_lista` / `informe_por_aprobar` / `cerrado`) |
| RF-006-14 | La ficha muestra rol, modalidad y antigüedad del formulario `estable` (`perfil_caso`), como contexto laboral no clínico |
| RF-006-15 | La ficha muestra la trayectoria de las últimas seis aplicaciones del OLBI y el pronóstico del modelo para la próxima semana con su confianza y una explicación metodológica plegada (ESP-005) |

## 6. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-006-01 | El psicólogo accede por **derivación**, nunca por organización | Si el acceso fuera por empresa, un psicólogo podría navegar los 100 participantes. La derivación acota a quienes realmente atiende |
| RN-006-02 | La identidad se revela solo dentro de una derivación abierta | El anonimato protege el dataset de investigación; la atención clínica exige identidad. Separar ambos ámbitos es lo que hace defendible el diseño |
| RN-006-03 | Toda revelación de identidad se registra en `eventos` | Un comité de ética puede preguntar quién vio los datos de quién y cuándo. Sin registro, no hay respuesta |
| RN-006-04 | El investigador ve datos anonimizados por defecto | Reduce la exposición innecesaria en el trabajo diario de análisis, que es la mayor parte del uso |
| RN-006-05 | Ningún rol puede insertar eventos `deteccion` desde el cliente | Solo la `service_role` vía ESP-003. Una detección es un dato de investigación, no una opinión |
| RN-006-06 | El rol vive en una tabla del servidor, nunca en metadatos editables del token | Un rol autodeclarado por el cliente no es un control de acceso |
| RN-006-07 | Las respuestas de instrumentos distintos al OLBI no son visibles para el psicólogo, **con una única excepción acotada**: rol, modalidad y antigüedad del formulario `estable`, expuestas por `perfil_caso` | Horas de sueño y carga percibida son insumo del modelo, no información clínica que el participante consintió compartir con un terapeuta. Rol y modalidad son contexto laboral que el psicólogo necesita para situar a la persona; se exponen por función, nunca por acceso a la tabla. El bloque «Contexto de la semana» del diseño (horas, sueño, guardias) **no se implementa** por esta regla; si el asesor lo quiere, cambia el consentimiento, no el código |

## 7. Contratos de datos

```sql
-- Rol asignado en servidor (RN-006-06)
usuarios_rol
  auth_user_id, rol, creado_en

psicologos
  id, auth_user_id, nombre, colegiatura, activo

-- Punto único donde se cruza identidad con datos de investigación
derivaciones
  id, participante_id, psicologo_id,
  evento_deteccion_id,
  abierta_en, cerrada_en           -- RF-006-06

-- Identidad, separada del esquema de investigación (RN-006-02)
identidades
  participante_id, nombre, correo_contacto
```

`identidades` es la única tabla con datos personales. Ningún rol la consulta directamente: se accede mediante una función que verifica derivación abierta y registra el acceso en `eventos`.

## 8. Matriz de acceso

| Recurso | Participante | Psicólogo | Investigador |
|---|---|---|---|
| Respuestas propias | Lectura y escritura | — | — |
| Respuestas de otros | — | Solo OLBI, si derivado | Lectura anonimizada |
| Identidad | Propia | Si derivación abierta | Acción explícita registrada |
| Eventos de detección | Propios | Si derivado | Lectura, todos |
| Crear detección | — | — | — *(solo `service_role`)* |
| Inscribir participantes | — | — | Sí |
| Indicadores del estudio | — | — | Sí |

## 9. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-006-01 | Dado un psicólogo sin derivación con P, cuando consulta a P, entonces RLS lo rechaza | Prueba automatizada |
| CA-006-02 | Dada una derivación cerrada, entonces el psicólogo pierde el acceso a esa identidad | Prueba automatizada |
| CA-006-03 | Dado un acceso a identidad, entonces existe una fila en `eventos` que lo registra | Prueba automatizada |
| CA-006-04 | Dado un psicólogo con derivación, cuando consulta respuestas del formulario `diario`, entonces se rechaza | Prueba automatizada |
| CA-006-05 | Dado un cliente que altera su rol en el token, entonces el acceso sigue determinado por `usuarios_rol` | Prueba automatizada |
| CA-006-06 | La exportación del investigador no contiene ningún campo identificable | Revisión manual del archivo |

## 10. Trazabilidad

| Requisito | Implementado en |
|---|---|
| RF-006-02, RF-006-06 | `supabase/migrations/20260829090300_roles_y_derivaciones.sql` — `tiene_derivacion_abierta()` |
| RF-006-03, RF-006-12 | `20260829090300_roles_y_derivaciones.sql` — `obtener_identidad()` |
| RF-006-04 | `20260829090300_roles_y_derivaciones.sql` — política *psicologo lee solo OLBI del derivado* |
| RF-006-08 | `20260829090300_roles_y_derivaciones.sql` — políticas del investigador |
| RN-006-01 | `20260829090300_roles_y_derivaciones.sql` — tabla `derivaciones` |
| RN-006-02 | `20260829090300_roles_y_derivaciones.sql` — tabla `identidades`, sin políticas de lectura |
| RN-006-03 | `20260829090300_roles_y_derivaciones.sql` — evento `acceso_identidad` en `obtener_identidad()` |
| RN-006-05 | `20260829090300_roles_y_derivaciones.sql` — ausencia deliberada de políticas INSERT sobre `eventos` |
| RN-006-06 | `20260829090300_roles_y_derivaciones.sql` — tabla `usuarios_rol` |
| RF-006-05, RF-006-07, RF-006-09 … RF-006-11, RF-006-13, RF-006-14 | *pendiente* — panel web y app |

### Trazabilidad de la revisión 2 (vista móvil)

| Requisito | Implementado en |
|---|---|
| RF-006-13, RF-006-14, RN-006-07 (excepción) | `supabase/migrations/20260918170000_casos_psicologo.sql` (vista `casos_psicologo`, función `perfil_caso`, política sobre `organizaciones`) |
| RF-006-13 … RF-006-15 (pantallas) | `app/psicologo/index.tsx`, `app/psicologo/caso/[id].tsx`, `modules/psicologo/piezas.tsx`, `modules/psicologo/datos.ts` |

## 11. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| 1 | ¿Existe un rol para la empresa participante? El consentimiento redactado afirma que la empresa no accede a respuestas individuales; queda por decidir si accede a algo agregado, y desde qué número de participantes para que no sea reidentificable | Asesor |
| 2 | ¿Quién decide la derivación: automática al detectar, o revisada por el investigador antes de derivar? | Asesor |
| 3 | ¿El psicólogo ve la trayectoria histórica de puntajes o solo la detección puntual? | Asesor + psicólogo colaborador |
| 4 | Actualizar el texto del consentimiento para declarar explícitamente que una derivación revela la identidad al psicólogo (ESP-001 §9) | Autores |
