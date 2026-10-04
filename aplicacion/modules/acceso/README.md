# acceso

Autenticación e identificación del trabajador. Especificación: [ESP-001](../../../specs/ESP-001-acceso-y-consentimiento.md).

| Archivo | Responsabilidad |
|---|---|
| `datos.ts` | Código por correo, sesión, lectura del trabajador |

**Invariante clave (RN-001-01):** el correo vive solo en `auth.users`. Nunca se copia a las tablas de investigación, que se identifican por código anónimo. Si algún día se necesita cruzar identidad con datos, ese cruce lo hace el equipo investigador fuera de la app.
