# consentimiento

Consentimiento informado. Especificación: [ESP-001](../../../specs/ESP-001-acceso-y-consentimiento.md).

| Archivo | Responsabilidad |
|---|---|
| `datos.ts` | Registro y consulta de decisiones, versionado del texto |

**Invariantes:**

- Append-only (RN-001-02): una decisión nueva agrega fila, nunca sobrescribe.
- El rechazo se registra (RN-001-03). Ausencia de fila es ambiguo: no distingue "rechazó" de "nunca abrió la app", y esa diferencia importa para reportar la tasa de participación.
- `puedeRecolectar()` es la puerta de RN-001-04. Ninguna pantalla de recolección debe saltarla.

Al cambiar el texto del consentimiento hay que incrementar `VERSION_TEXTO`: los participantes vuelven a decidir sobre el texto nuevo, y queda registro de qué versión aceptó cada uno.
