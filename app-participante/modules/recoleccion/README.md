# recoleccion

Captura longitudinal de datos. Especificación: [ESP-002](../../../specs/ESP-002-recoleccion-de-datos.md).

| Archivo | Responsabilidad |
|---|---|
| `datos.ts` | Lectura de formularios, envío de respuestas, eventos |
| `agenda.ts` | Qué instrumento toca hoy. Lógica pura, sin dependencias |
| `recordatorios.ts` | Notificación local diaria |
| `componentes/Campo.tsx` | Renderiza un ítem según su tipo |
| `componentes/Formulario.tsx` | Compone los ítems y valida completitud |

**Invariantes:**

- Ítem por ítem (RF-002-03). El puntaje agregado no se almacena jamás: se recalcula desde los ítems crudos, para que cambiar un umbral no obligue a recolectar de nuevo.
- `iniciado_en` se captura al montar la pantalla, no al enviar (RN-002-03). Es la mitad del indicador de tiempo de detección de la tesis; capturarlo al enviar lo dejaría siempre en cero.
- El cliente nunca calcula un puntaje ni decide una detección (RN-002-05). Eso es competencia del servidor, en ESP-003.
- Toda respuesta guarda `formulario_version` (RN-002-02).

`agenda.ts` no importa nada: es lógica pura y se puede probar sin base de datos ni interfaz.
