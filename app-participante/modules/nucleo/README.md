# nucleo

Infraestructura compartida. **No contiene lógica de dominio.**

| Archivo | Responsabilidad |
|---|---|
| `supabase.ts` | Cliente único de base de datos |
| `tipos.ts` | Contratos compartidos entre módulos |

Regla: si algo aquí depende de un módulo de dominio, está en el lugar equivocado.
