# ESP-008 · Maestros y administración de empresas

| | |
|---|---|
| **Estado** | Implementada |
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

## 9. Decisiones abiertas

1. **Mínimo de reporte = 10.** Elegido por convención de k-anonimato; debería
   confirmarlo el asesor a la luz del tamaño real de las empresas
   participantes. Cambia en un solo sitio: `minimo_para_reportar()`.
2. **¿El admin debería poder dar de baja a un participante?** Hoy no puede.
   Retirarse del estudio es una decisión del participante (ESP-001), pero falta
   resolver qué pasa cuando alguien deja la empresa.
3. **Reasignación de casos** al dar de baja a un psicólogo.
