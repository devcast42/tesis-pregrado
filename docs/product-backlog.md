# Product backlog

Sistema de detección temprana del síndrome de Burnout en profesionales del
sector tecnológico — Universidad Nacional de Trujillo, Ingeniería de Sistemas.

Última revisión: 4 de setiembre de 2026 (épicas E1–E3 y E6–E8 completadas con historias).

---

## Cómo leer esto

**Estado** — `Hecho` · `En curso` · `Listo para tomar` · `Bloqueado`

**Prioridad**

| | |
|---|---|
| **Crítico** | Sin esto no hay tesis defendible |
| **Alto** | El sistema funciona sin ello, pero se nota en la defensa |
| **Medio** | Mejora real, no bloquea |
| **Bajo** | Se puede declarar fuera de alcance sin perder nada |

**Tamaño** — `S` una sesión de trabajo · `M` dos o tres · `L` más de tres, o
depende de terceros.

Cada historia apunta a su especificación (`specs/ESP-XXX`). Si una historia no
tiene spec, es señal de que hay que escribirla antes de codearla — es la regla
de SDD que sigue el proyecto.

---

## Estado actual

El sistema **está construido y verificado de punta a punta** para el flujo
principal: inscripción → consentimiento → recolección → evaluación OLBI →
detección → derivación automática → caso del psicólogo, con RLS comprobada a
nivel de API para los cuatro roles.

Lo que falta se reparte en tres montones muy distintos, y conviene no
confundirlos:

1. **Decisiones de terceros** (asesor, comité de ética). No son trabajo de
   programación y son el camino crítico real.
2. **El componente de videoconsulta e informe**, escrito pero sin desplegar.
3. **Acabado**: rediseño de las pantallas que faltan y pruebas automatizadas.

---

## ⚠️ El camino crítico no es el código

Nueve decisiones están fuera de tus manos y bloquean partes del sistema o del
documento. Ninguna se resuelve programando. Si solo persigues una cosa esta
semana, que sea esta lista.

| # | Bloqueo | Quién | Qué bloquea |
|---|---|---|---|
| B1 | **Puntos de corte del OLBI**, con referencia bibliográfica | Asesor | ESP-003. Hoy corren umbrales `provisional-v0` inventados por nosotros. Cualquier resultado calculado con ellos es indefendible |
| B2 | **Criterio de detección**: ¿ambas dimensiones sobre el umbral o basta una? | Asesor | ESP-003. Cambia quién se considera detectado, o sea, cambia todos los resultados |
| B3 | **Formulación del modelo**: clasificación puntual vs. predicción de trayectoria | Asesor | ESP-005. Ver `docs/requisitos-y-arquitectura.md` §5.2. Determina qué dataset hay que exportar |
| B4 | **Redacción de HE1** | Asesor | §5.6. Tal como está redactada no se puede ganar; hay que reformularla antes de recolectar |
| B5 | **Duración del seguimiento en días** | Asesor | ESP-002. Sin esto no se sabe cuándo cierra la recolección ni qué es un caso censurado |
| B6 | **Texto del consentimiento informado**, aprobado | Comité de ética | ESP-001. La app muestra un marcador de posición. **No se puede reclutar a nadie hasta tenerlo** |
| B7 | **Plazo de retención** de audio y transcripción | Comité de ética | ESP-004. `borrar_datos_vencidos()` existe pero no sabe a cuántos días borrar |
| B8 | **¿La derivación es automática o la revisa el investigador?** | Asesor | ESP-006. Hoy es automática. El esquema soporta ambas; solo cambia quién inserta la fila |
| B9 | **Mínimo de reporte por empresa** (hoy 10) | Asesor | ESP-008. Con empresas pequeñas, 10 puede dejar todo oculto |

**B6 es el que manda.** Sin consentimiento aprobado no hay recolección; sin
recolección no hay datos; sin datos no hay modelo ni resultados. Todo lo demás
del backlog se puede hacer en paralelo, esto no.

---

## Épicas

| ID | Épica | Spec | Estado |
|---|---|---|---|
| **E1** | Acceso y consentimiento | ESP-001 | Hecho (texto pendiente de comité) |
| **E2** | Recolección longitudinal | ESP-002 | Hecho (contenido provisional) |
| **E3** | Evaluación OLBI y detección | ESP-003 | Hecho (umbrales provisionales) |
| **E4** | Videoconsulta, transcripción e informe | ESP-004 | Escrito, sin desplegar |
| **E5** | Modelo de detección | ESP-005 | Bloqueado |
| **E6** | Roles, permisos y auditoría | ESP-006 | Hecho |
| **E7** | Monitoreo de adherencia | ESP-007 | Hecho |
| **E8** | Maestros y administración | ESP-008 | Hecho |
| **E9** | Sistema de diseño y acabado de UI | — | En curso |
| **E10** | Verificación automatizada | — | **No empezado** |
| **E11** | Operación del estudio | — | No empezado |

---

## E1 · Acceso y consentimiento

Permite que un profesional inscrito acceda a la app, lea el consentimiento informado y lo acepte o rechace dejando registro auditable. El equipo de investigación inscribe cuentas; el participante nunca se autoregistra.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-E1-01 | Acceso con correo y contraseña; sesión persistente entre aperturas | Hecho | **Crítico** | — |
| PB-E1-02 | Correo no inscrito: mensaje de contacto con el equipo, sin crear cuenta | Hecho | **Crítico** | — |
| PB-E1-03 | Pantalla de consentimiento: texto completo, botones Aceptar / Rechazar | Hecho | **Crítico** | — |
| PB-E1-04 | Registro de rechazo como fila `aceptado = false` (no como ausencia) | Hecho | **Crítico** | — |
| PB-E1-05 | Bloqueo de cualquier formulario si no hay consentimiento aceptado vigente | Hecho | **Crítico** | — |
| PB-E1-06 | Flujo de retirada del consentimiento desde la app en cualquier momento | Hecho | Alto | — |
| PB-E1-07 | **Cargar el texto definitivo** aprobado por el comité e incrementar `VERSION_TEXTO` | Bloqueado por B6 | **Crítico** | S |

> El texto del consentimiento es un marcador de posición. **No se puede reclutar a nadie hasta tener el texto aprobado (B6).**

---

## E2 · Recolección longitudinal

Presenta los cuatro instrumentos en su cadencia, captura respuestas ítem por ítem y registra los eventos de proceso que alimentan los indicadores.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-E2-01 | Pantalla «Hoy» con instrumentos pendientes según cadencia diaria/semanal/quincenal | Hecho | **Crítico** | — |
| PB-E2-02 | Formulario `estable` (inscripción, una sola vez) | Hecho | **Crítico** | — |
| PB-E2-03 | Formulario `diario` (~30 s, bloqueo si ya enviado hoy) | Hecho | **Crítico** | — |
| PB-E2-04 | Formulario `semanal` | Hecho | **Crítico** | — |
| PB-E2-05 | Formulario `olbi` quincenal (16 ítems) | Hecho | **Crítico** | — |
| PB-E2-06 | Guardado ítem por ítem, append-only, con `formulario_version` y `iniciado_en` | Hecho | **Crítico** | — |
| PB-E2-07 | Racha de días completados visible para el participante | Hecho | Alto | — |
| PB-E2-08 | Recordatorio local diario a hora configurable | Hecho (sin verificar en dispositivo) | Alto | — |
| PB-E2-09 | **Cargar el contenido definitivo** de `diario`, `semanal` y `estable` | Bloqueado (ESP-002 §9 #2) | **Crítico** | S |
| PB-E2-10 | Fijar la **duración total del seguimiento** en días y comunicarla al sistema | Bloqueado por B5 | **Crítico** | S |

---

## E3 · Evaluación OLBI y detección

Dado un envío del OLBI, calcula el puntaje por dimensión, aplica el punto de corte y registra la detección si corresponde. Es el patrón oro que generará las etiquetas del modelo.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-E3-01 | Edge Function `evaluar-olbi`: inversión de ítems, media por dimensión | Hecho | **Crítico** | — |
| PB-E3-02 | Comparación con umbrales y escritura del evento `deteccion` con `metodo`, `puntajes` y `version_umbral` | Hecho | **Crítico** | — |
| PB-E3-03 | Cambio de estado del participante a `detectado` tras la detección | Hecho | **Crítico** | — |
| PB-E3-04 | RLS: ningún cliente puede insertar eventos `deteccion` | Hecho | **Crítico** | — |
| PB-E3-05 | Fallo explícito si faltan ítems o si los umbrales están en `null` | Hecho | Alto | — |
| PB-E3-06 | **Cargar umbrales OLBI definitivos** con referencia bibliográfica como nueva versión | Bloqueado por B1, B2 | **Crítico** | S |

> Con umbrales `provisional-v0`, cualquier resultado calculado es indefendible. Resolver B1 y B2 con el asesor es prioritario.

---

## E6 · Roles, permisos y auditoría

Define los tres roles del sistema, las políticas RLS que los aíslan y el punto controlado en que la identidad de un participante deja de estar anonimizada.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-E6-01 | Tabla `usuarios_rol` en servidor; el rol nunca lo declara el cliente | Hecho | **Crítico** | — |
| PB-E6-02 | RLS del participante: solo sus propios datos | Hecho | **Crítico** | — |
| PB-E6-03 | RLS del psicólogo: solo OLBI de participantes con derivación abierta | Hecho | **Crítico** | — |
| PB-E6-04 | RLS del investigador: lectura anonimizada de todo, con `codigo_anonimo` | Hecho | **Crítico** | — |
| PB-E6-05 | Función `obtener_identidad()`: revela nombre solo con derivación abierta y registra el acceso en `eventos` | Hecho | **Crítico** | — |
| PB-E6-06 | Tabla `identidades` separada del esquema de investigación; sin política de lectura directa | Hecho | **Crítico** | — |
| PB-E6-07 | Enrutamiento automático participante / psicólogo al autenticarse, sin selector manual | Hecho | Alto | — |
| PB-E6-08 | Notificación push al psicólogo al abrirse una derivación | Listo para tomar | Alto | S |
| PB-E6-09 | Exportación del dataset anonimizado para Jupyter (RF-006-10) | Listo para tomar | Alto | M |

---

## E7 · Monitoreo de adherencia

Hace visible quién está respondiendo y quién dejó de hacerlo, con antelación suficiente para intervenir antes de que el hueco sea irrecuperable.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-E7-01 | Vista `adherencia` con días sin check-in, tasa y estado por participante activo | Hecho | **Crítico** | — |
| PB-E7-02 | Estados `al_dia`, `en_riesgo`, `inactivo`, `nunca_inicio` con cortes ajustables | Hecho | **Crítico** | — |
| PB-E7-03 | Distinción `nunca_inicio` vs `inactivo` (consintió pero nunca respondió) | Hecho | Alto | — |
| PB-E7-04 | Registro de `alerta_adherencia` una sola vez por episodio, no a diario | Hecho | Alto | — |
| PB-E7-05 | Participantes detectados excluidos del monitoreo | Hecho | Alto | — |
| PB-E7-06 | Vista de adherencia agregada por organización | Hecho | Alto | — |
| PB-E7-07 | Panel del investigador: sección de adherencia en tiempo real | Listo para tomar | Alto | S |
| PB-E7-08 | Protocolo de contacto para participantes `inactivo`/`nunca_inicio`: quién actúa y por qué medio | Listo para tomar | Alto | S |

---

## E8 · Maestros y administración

Define quién puede crear empresas, cuentas y participantes, y protege al administrador de empresa de ver datos de salud de sus compañeros.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-E8-01 | Edge Function `crear-admin`: investigador crea admin en una empresa | Hecho | **Crítico** | — |
| PB-E8-02 | Edge Function `crear-psicologo`: investigador crea psicólogo del estudio | Hecho | **Crítico** | — |
| PB-E8-03 | Edge Function `inscribir-participante`: investigador o admin inscriben en su empresa | Hecho | **Crítico** | — |
| PB-E8-04 | Edge Function `restablecer-contrasena`: investigador cualquiera, admin solo los suyos | Hecho | Alto | — |
| PB-E8-05 | Contraseña generada mostrada una sola vez en pantalla | Hecho | Alto | — |
| PB-E8-06 | Vista `participacion_empresa` (SECURITY DEFINER): el admin ve `en_seguimiento`, nunca `estado` real | Hecho | **Crítico** | — |
| PB-E8-07 | Cifras agregadas del admin ocultas si la empresa tiene menos de 10 inscritos (`minimo_para_reportar`) | Hecho | **Crítico** | — |
| PB-E8-08 | Panel del investigador: Empresas, detalle de empresa, Psicólogos, Derivaciones, Auditoría | En curso (rediseño) | Alto | — |
| PB-E8-09 | Panel del admin de empresa: resumen y lista de participantes | Listo para tomar (rediseño PB-10) | Medio | S |
| PB-E8-10 | Confirmar el mínimo de reporte (hoy 10) con el asesor según tamaño real de empresas | Bloqueado por B9 | Medio | S |
| PB-E8-11 | Flujo de baja de psicólogo con casos abiertos (reasignación de derivaciones) | Listo para tomar | Medio | M |

---

## E9 · Sistema de diseño y acabado de UI

El panel del investigador se está rediseñando pantalla por pantalla contra
mockups. Tres hechas, el resto pendientes. Mientras no se terminen, el panel
se ve mezclado: unas tablas van en tarjeta y otras no.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-01 | Sistema de diseño con Inter, tokens de color, tipografía y forma | Hecho | Alto | — |
| PB-02 | Panel con barra lateral, barra superior con identidad y cierre de sesión | Hecho | Alto | — |
| PB-03 | Rediseño de **Resumen** del investigador | Hecho | Alto | — |
| PB-04 | Rediseño de **Participantes** | Hecho | Alto | — |
| PB-05 | Rediseño de **Empresas** | Hecho | Alto | — |
| PB-06 | Rediseño de **Derivaciones** | Listo para tomar | Alto | S |
| PB-07 | Rediseño de **Psicólogos** | Listo para tomar | Alto | S |
| PB-08 | Rediseño de **Auditoría** | Listo para tomar | Alto | S |
| PB-09 | Rediseño de **detalle de empresa** (pestañas Participantes / Administradores) | Listo para tomar | Alto | M |
| PB-10 | Rediseño de las dos pantallas del **admin de empresa** | Listo para tomar | Medio | S |
| PB-11 | Rediseño de las pantallas del **participante** (móvil: hoy, formulario, consentimiento) | Listo para tomar | Medio | M |
| PB-12 | Rediseño de las pantallas del **psicólogo** (caso, consulta, informe) | Listo para tomar | Medio | M |
| PB-13 | Coherencia: pasar todas las tablas a tarjeta de una vez | Listo para tomar | Medio | S |
| PB-14 | Estados vacíos revisados en las 20 pantallas | Listo para tomar | Bajo | S |
| PB-15 | Revisión de la app en un teléfono real, no solo en navegador | Listo para tomar | **Alto** | M |

> **PB-15 importa más de lo que parece.** Toda la verificación hasta hoy se ha
> hecho en el navegador. Las pantallas del participante son móviles y se
> responden con prisa y con una mano; nunca se han abierto en un teléfono.

---

## E10 · Verificación automatizada

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-16 | Montar el arnés de pruebas (runner, cliente Supabase de pruebas, datos semilla) | Listo para tomar | **Crítico** | M |
| PB-17 | Pruebas de aislamiento RLS por rol (CA-006-01 … CA-006-05) | Listo para tomar | **Crítico** | M |
| PB-18 | Pruebas del cálculo OLBI: inversión, dimensiones, extremos 1.00 y 4.00 | Listo para tomar | **Crítico** | S |
| PB-19 | Pruebas de adherencia: cortes, censura, huso horario de Lima | Listo para tomar | Alto | M |
| PB-20 | Pruebas del alcance del admin (CA-008-01 … CA-008-03) | Listo para tomar | Alto | S |
| PB-21 | Pruebas de los criterios de ESP-004 (informes, retención) | Bloqueado por E4 | Medio | M |

> **Las especificaciones prometen 29 criterios verificados por "prueba
> automatizada" y no existe ninguna.** Hoy todo se ha comprobado a mano, con
> `curl` y tokens reales, y esas comprobaciones no dejan rastro reproducible.
> En una defensa, "lo probé y funcionaba" vale bastante menos que una suite que
> se ejecuta delante del jurado. Es la mayor deuda del proyecto.

---

## E4 · Videoconsulta, transcripción e informe

Decidido (20 set 2026): **entra**. Las cinco funciones están desplegadas, el
bucket privado `audio-sesiones` existe y el texto del consentimiento declara
los proveedores. Faltan las llaves y el webhook: `docs/despliegue-grabacion.md`
tiene el paso a paso. Sin llaves la sesión ocurre igual, sin grabación.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-22 | Llaves S3 de Storage, Deepgram y Anthropic en los secretos (LiveKit ya está) | **Hecho** (20 set 2026) | Alto | S |
| PB-23 | Desplegar las cinco funciones y configurar los dos webhooks | **Hecho** (20 set 2026) | Alto | S |
| PB-24 | Probar videollamada 1 a 1 entre dos navegadores | **Hecho** (20 set 2026, teléfono + web) | Alto | M |
| PB-25 | Probar el circuito completo: grabar → transcribir → redactar → aprobar | **Hecho** de forma automática (20 set 2026, sesión `3250af9f…`: audio → transcripción → borrador en 30 s). Falta ejercitar «Aprobar informe» | Alto | M |
| PB-26 | Ajustar el esquema del informe con el psicólogo colaborador | Bloqueado (ESP-004 §11 #5) | Medio | M |
| PB-27 | Programar `borrar_datos_vencidos()` cuando el comité fije el plazo | Bloqueado por B7 | Alto | S |
| PB-28 | Declarar los proveedores en el texto del consentimiento (RN-004-07) | Redactado en la app (`v2-2026-09`); pendiente de aprobación del comité (B6) | **Crítico** | S |

> Decidid pronto si este componente entra o no. Si entra, hay que declararlo en
> el consentimiento **antes** de reclutar (PB-28), no después. Si se retira, se
> ahorran PB-22 a PB-27 y el documento de tesis se simplifica.

---

## E5 · Modelo de detección

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-29 | Escribir **ESP-005** una vez resuelto B3 | Bloqueado por B3 | **Crítico** | M |
| PB-30 | Definir el dataset de entrenamiento y su exportación | Bloqueado por PB-29 | **Crítico** | M |
| PB-31 | Partición sin fuga: `GroupKFold` por participante (§5.3) | Bloqueado por PB-30 | **Crítico** | M |
| PB-32 | Entrenar la línea base y comparar contra el método por umbral | Bloqueado por PB-31 | **Crítico** | L |
| PB-33 | Servir el modelo (fake API primero, real después) | Bloqueado por PB-32 | Alto | M |
| PB-34 | Poblar `indicador_precision` con predicciones reales | Bloqueado por PB-33 | Alto | S |

> El panel ya reserva el sitio del Indicador 1 y explica por qué está vacío.
> Reporta **precisión, recall y F1** a propósito: la precisión sola es
> manipulable — un modelo que casi nunca detecta puede alcanzar 100% y no
> servir para nada. Falta añadirlo al Anexo 3 del documento (§8 #4).

---

## E11 · Operación del estudio

Lo que hace falta para que el sistema deje de ser una demostración y recoja
datos de verdad.

| ID | Historia | Estado | Prio | Tam |
|---|---|---|---|---|
| PB-35 | Cargar el texto de consentimiento aprobado e incrementar `VERSION_TEXTO` | Bloqueado por B6 | **Crítico** | S |
| PB-36 | Cargar el contenido definitivo de `diario`, `semanal` y `estable` | Bloqueado (ESP-002 §9 #2) | **Crítico** | S |
| PB-37 | Cargar los umbrales OLBI definitivos como una versión nueva | Bloqueado por B1, B2 | **Crítico** | S |
| PB-38 | Verificar notificaciones push en dispositivo real (Android e iOS) | Listo para tomar | Alto | M |
| PB-39 | Hora por defecto del recordatorio diario (ESP-002 §9 #3) | Listo para tomar | Medio | S |
| PB-40 | Protocolo de contacto con participantes inactivos: quién y por qué medio | Listo para tomar | Alto | S |
| PB-41 | Manual de operación para el admin de cada empresa | Listo para tomar | Medio | M |
| PB-42 | Copia de seguridad y plan de recuperación de la base | Listo para tomar | Alto | S |
| PB-43 | Cambiar las contraseñas de prueba antes de reclutar | Listo para tomar | **Crítico** | S |

---

## Deuda técnica conocida

| ID | Deuda | Prio | Tam |
|---|---|---|---|
| DT-01 | Sin pruebas automatizadas (ver E10) | **Crítico** | L |
| DT-02 | `resumen_estudio` y las vistas agregadas se han ido cerrando de a una; conviene una revisión sistemática de qué ve cada rol en **cada** vista | Alto | M |
| DT-03 | Dar de baja a un psicólogo con casos abiertos exige reasignar a mano en la base | Medio | M |
| DT-04 | Sin manejo de reconexión ni de red caída en los formularios del participante | Alto | M |
| DT-05 | Los fondos oscuros de la videollamada usan colores literales, fuera del sistema de diseño | Bajo | S |
| DT-06 | No hay registro de errores del lado del cliente: si a un participante le falla el envío, nadie se entera | Alto | M |
| DT-07 | Las Edge Functions no tienen pruebas ni validación de esquema de entrada | Medio | M |

> **DT-06 es más grave de lo que su tamaño sugiere.** En un estudio
> longitudinal, un fallo silencioso de envío se ve semanas después como "baja
> adherencia" y es indistinguible de un abandono real. Contamina el indicador.

---

## Fuera de alcance

Escrito aquí para no volver a discutirlo:

- App nativa publicada en las tiendas. El estudio se distribuye por enlace.
- Autenticación por SSO corporativo, biometría o MFA.
- Panel para la empresa más allá del rol `admin` ya definido.
- Chat o mensajería entre participante y psicólogo.
- Internacionalización. El estudio es en español y en Perú.
- Modo oscuro.
- Edición del nombre de una empresa, y jerarquía entre administradores.

---

## Orden sugerido

**Ahora, en paralelo:**

1. Perseguir **B6** (consentimiento) y **B1/B2** (umbrales). Todo lo demás
   espera a esto, y no depende de ti.
2. **PB-16 a PB-18** — el arnés de pruebas y los dos cálculos que sostienen la
   tesis: OLBI y RLS.
3. **PB-06 a PB-09** — terminar el rediseño del panel del investigador, que es
   lo que se proyecta en la defensa.

**Después:**

4. **PB-15 y PB-38** — la app en un teléfono real con notificaciones.
5. E4 decidido: se despliega. Cargar llaves y webhook (PB-22, PB-23) y probar (PB-24, PB-25).
6. **PB-35 a PB-37 y PB-43** — cargar contenido definitivo y cerrar el sistema
   para reclutar.

**Cuando el asesor desbloquee B3:**

7. E5 completa, que es la parte larga.

---

## Mapa de dependencias

```
B6 consentimiento ──→ PB-35 ──→ reclutar ──→ datos ──┐
B1,B2 umbrales    ──→ PB-37 ──────────────────────────┤
B5 duración       ──────────────────────────────────┤
                                                     ↓
B3 formulación ──→ PB-29 ESP-005 ──→ PB-30 ──→ PB-31 ──→ PB-32 ──→ PB-33 ──→ PB-34
                                                                              ↓
B4 HE1 ────────────────────────────────────────────────────→ resultados de la tesis

PB-22 llaves ──→ PB-23 desplegar ──→ PB-24 llamada ──→ PB-25 informe
B7 retención ──→ PB-27
B6 ──────────→ PB-28 declarar proveedores

PB-16 arnés ──→ PB-17, PB-18, PB-19, PB-20
```
