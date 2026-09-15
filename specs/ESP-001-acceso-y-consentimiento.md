# ESP-001 · Acceso y consentimiento informado

| | |
|---|---|
| **Estado** | Aprobada |
| **Módulo** | `modules/acceso`, `modules/consentimiento` |
| **Depende de** | — |

## 1. Justificación en la tesis

Las Consideraciones Éticas del proyecto exigen **participación voluntaria**, **consentimiento explícito** y **anonimización mediante códigos de identificación**. Con empresas reales de por medio, el consentimiento debe quedar registrado de forma auditable: no basta con que la empresa autorice, cada profesional consiente por sí mismo.

## 2. Propósito

Permitir que un profesional inscrito acceda a la app, lea el consentimiento informado y lo acepte o rechace, dejando registro verificable — sin que ningún dato identificable llegue a las tablas de investigación.

## 3. Fuera de alcance

- Registro abierto. **La inscripción la hace el equipo de investigación**, no el participante: la población es censal y cerrada (100 profesionales).
- Recuperación de contraseña automática. Si alguien la pierde, el investigador se la restablece.
- Panel de administración para el equipo investigador.

### Por qué contraseña y no código por correo

El acceso por código exige un servicio de correo con dominio verificado, que
este proyecto no tiene. Sin él, ningún participante puede entrar — el estudio
queda bloqueado por un problema de infraestructura ajeno a la investigación.

Con contraseña, la entrega de credenciales ocurre por el canal que el equipo
prefiera (sesión informativa, RR.HH., mensaje directo), que además es donde ya
tiene que ocurrir el consentimiento informado.

## 4. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-001-01 | El acceso se realiza con correo y contraseña. La contraseña la genera el sistema al inscribir y se la entrega el equipo de investigación al participante |
| RF-001-02 | La sesión persiste entre aperturas de la app; el participante no reingresa a diario |
| RF-001-03 | Si la cuenta autenticada no está vinculada a un participante inscrito, se muestra un mensaje que indica contactar al equipo de investigación |
| RF-001-04 | Antes de cualquier recolección, se presenta el texto completo del consentimiento informado |
| RF-001-05 | El participante puede **aceptar o rechazar**; ambas decisiones se registran |
| RF-001-06 | Si rechaza, no se le solicita ningún dato y se le informa cómo revertir la decisión |
| RF-001-07 | El participante puede retirar su consentimiento en cualquier momento desde la app |

## 5. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-001-01 | El correo del participante vive **solo** en `auth.users`, nunca en `participantes` | Separa identidad de datos de investigación. Las tablas del estudio quedan anonimizadas por diseño, no por convención |
| RN-001-02 | `consentimientos` es append-only y versionada por texto | Si el texto cambia, hay que poder demostrar qué versión aceptó cada persona. Un comité de ética puede pedirlo |
| RN-001-03 | Un rechazo se registra como fila con `aceptado = false`, no como ausencia de fila | Ausencia de fila es ambiguo: ¿rechazó o nunca abrió la app? La distinción importa para reportar la tasa de participación |
| RN-001-04 | Sin consentimiento aceptado vigente, la app no permite acceder a ningún formulario | Recolectar sin consentimiento invalida el dato y expone el estudio |

## 6. Contratos de datos

```
participantes
  id, organizacion_id, auth_user_id, codigo_anonimo, estado, inscrito_en

consentimientos                                       (append-only)
  id, participante_id, version_texto, aceptado, registrado_en
```

Estado del participante: `activo` → `detectado` | `retirado` | `finalizado`.

## 7. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-001-01 | Dado un correo no inscrito, cuando solicita acceso, entonces no se crea participante y se muestra el mensaje de RF-001-03 | Manual |
| CA-001-02 | Dado un participante sin consentimiento, cuando abre la app, entonces es dirigido a la pantalla de consentimiento y no puede saltarla | Manual |
| CA-001-03 | Dado un participante que rechaza, entonces existe una fila con `aceptado = false` y no se registra ninguna respuesta | Manual |
| CA-001-04 | Dado un participante que acepta y luego retira, entonces ambas filas coexisten ordenadas por fecha | Manual |
| CA-001-05 | Consultando `participantes` con la clave anónima, ningún campo permite identificar a una persona | Revisión de esquema |

## 8. Trazabilidad

| Requisito | Implementado en |
|---|---|
| RF-001-01, RF-001-02 | `modules/acceso/datos.ts`, `app/acceso.tsx` |
| RF-001-03 | `app/index.tsx` |
| RF-001-04 … RF-001-07 | `modules/consentimiento/`, `app/consentimiento.tsx` |
| RN-001-01 … RN-001-04 | `supabase/migrations/20260829090100_esquema_inicial.sql` |

## 9. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| 1 | Texto definitivo del consentimiento informado, aprobado por el comité de ética | Asesor / comité |
| 2 | ¿Correo institucional de la empresa o personal? Afecta la percepción de confidencialidad del participante | Autores |
