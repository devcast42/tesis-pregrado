# Especificaciones

Este proyecto se desarrolla con **Spec-Driven Development**: ninguna funcionalidad se implementa sin una especificación previa que la describa.

## Por qué, en el contexto de esta tesis

La recolección longitudinal es irreversible. Un requisito mal entendido no se corrige con un parche: se corrige recolectando datos otra vez, y en un estudio de meses eso no existe. La especificación es el lugar donde ese error todavía es barato.

Además da **trazabilidad**: cada especificación declara qué objetivo o indicador de la tesis la justifica, y cada archivo de código declara qué especificación implementa. En la sustentación se puede recorrer el camino completo, de un objetivo específico a la línea que lo cumple.

## Flujo de trabajo

```
1. Escribir la especificación      →  specs/ESP-XXX-nombre.md
2. Revisar y aprobar               →  estado: aprobada
3. Implementar                     →  modules/<modulo>/
4. Verificar criterios             →  cada CA-XXX-NN comprobado
5. Marcar implementada             →  estado: implementada
```

Si al implementar aparece algo que la especificación no previó, **se actualiza la especificación primero** y después el código. Nunca al revés: una especificación que miente es peor que no tenerla.

## Convenciones de numeración

| Prefijo | Significado | Ejemplo |
|---|---|---|
| `ESP-XXX` | Especificación | `ESP-002` |
| `RF-XXX-NN` | Requisito funcional | `RF-002-03` |
| `RN-XXX-NN` | Regla de negocio | `RN-002-01` |
| `CA-XXX-NN` | Criterio de aceptación | `CA-002-05` |

Los identificadores **no se reutilizan**. Si un requisito se elimina, su número queda retirado y se marca como tal — así una referencia vieja nunca apunta a algo distinto de lo que decía.

## Índice

| ID | Especificación | Estado | Módulo |
|---|---|---|---|
| [ESP-001](ESP-001-acceso-y-consentimiento.md) | Acceso y consentimiento informado | Aprobada | `modules/acceso`, `modules/consentimiento` |
| [ESP-002](ESP-002-recoleccion-de-datos.md) | Recolección longitudinal de datos | Implementada · rev. 2 (calendario semanal) aplicada | `modules/recoleccion` |
| [ESP-003](ESP-003-evaluacion-olbi.md) | Evaluación por umbral OLBI | Implementada · rev. 2 (OLBI semanal) aplicada | `supabase/functions/evaluar-olbi` |
| [ESP-004](ESP-004-videoconsulta-e-informe.md) | Videoconsulta, transcripción e informe | Videollamada operativa; grabación/transcripción/informe desplegados, pendientes de llaves (`docs/despliegue-grabacion.md`) | `modules/consulta`, Edge Functions |
| [ESP-005](ESP-005-modelo-de-deteccion.md) | Modelo de detección | Rev. 2 parcialmente implementada (preentrenamiento y predicción en SQL); entrenamiento propio pendiente | `modelo/`, `supabase/migrations/20260918120000_modelo_versiones.sql` |
| [ESP-006](ESP-006-roles-y-permisos.md) | Roles y permisos | Implementada · vista móvil del psicólogo rev. 2 | `supabase/migrations`, `app/psicologo`, panel web |
| [ESP-007](ESP-007-monitoreo-de-adherencia.md) | Monitoreo de adherencia | Implementada · rev. 2 (días laborables) aplicada | `supabase/migrations/20260918110000_adherencia_dias_laborables.sql` |
| [ESP-008](ESP-008-maestros-y-administracion.md) | Maestros y administración de empresas · rev. 2 panel del empresario | Implementada | `modules/panel`, `supabase/migrations/20260904110000_admin_sin_estado.sql` |
| [ESP-009](ESP-009-panel-del-investigador.md) | Panel del investigador: bandeja de hoy, cohorte, ficha unitaria, desempeño del modelo, exportación | Borrador · pendiente del asesor | — |

## Documentos relacionados

- [Requisitos y arquitectura](../docs/requisitos-y-arquitectura.md) — visión general, stack y decisiones pendientes
- [Diseño semanal con preentrenamiento](../docs/diseno-semanal-con-preentrenamiento.md) — la revisión 2 de ESP-002/003/005/007, con su justificación
- [Plantilla de especificación](PLANTILLA.md)
