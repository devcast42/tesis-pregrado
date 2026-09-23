# Prompt para Stitch — panel del investigador, segunda entrega

Continúa el diseño `NsWTiSKab9HJt9b2EBz7XA` (Hoy, Participantes, Ficha, Desempeño, Exportación). Copiar desde la línea siguiente.

---

Diseña las **cinco pantallas que faltan** del panel web del investigador principal de un sistema de detección temprana de burnout en profesionales de tecnología (estudio universitario). Ya diseñaste Hoy, Participantes, Ficha del participante, Desempeño del modelo y Exportación; estas cinco deben ser de la **misma familia exacta**: misma barra lateral (grupos ESTUDIO / PERSONAS / MODELO / DATOS / MAESTROS, filtro global de empresa y semanas, búsqueda ⌘K), misma barra superior («Base de datos sincronizada · Muestra activa · Actualizar · Exportar corte»), mismos encabezados con eyebrow en mayúsculas pequeñas, mismas tarjetas, pastillas, tablas y gráficas. Escritorio 1440 × 900; razonable a 1024.

Quién la usa: el investigador que dirige el estudio. Ve todo hasta la unidad, siempre por **código anónimo** («P-042»), nunca por nombre; la identidad se abre solo con una acción explícita que queda registrada. Nunca ve contenido clínico (informes, transcripciones): solo que ocurrieron.

## Las cinco pantallas

### 1. Resumen — el estado del estudio en una página

Es la pantalla de aterrizaje después de Hoy; es lo que el investigador enseña a su asesor. Contiene:

- **Tres indicadores del estudio, cada uno con su fórmula visible** debajo del número (numerador / denominador / ventana), porque son los indicadores de la tesis: *adherencia* (días con check-in / días hábiles esperados, últimas 6 semanas), *tasa de detección* (participantes con OLBI sobre el umbral / participantes con OLBI del viernes, por semana) y *tiempo de respuesta del circuito* (mediana en días de detección → primera sesión). Con n y con ⓘ.
- **Cohorte por semana del estudio**: barras apiladas o área por semana S1…S6 con inscritos, activos, detectados, retirados, finalizados. Al lado, la cifra de la semana en curso.
- **Adherencia global y por empresa**: una barra por empresa (código y nombre de la empresa; aquí sí se ven nombres de empresas, no de personas), ordenadas de menor a mayor, con la línea de la media del estudio. Las empresas por debajo del corte de alerta en ámbar.
- **Detecciones y estado de derivación**: un embudo pequeño: detectados → derivados → con cita → con sesión → con informe aprobado, con las cifras y los porcentajes entre pasos.
- **Modelo activo por tarea**: dos tarjetas compactas (Nowcast, Pronóstico) con versión activa, umbral τ, precisión/recall en vivo y un enlace «Ver desempeño».
- **Distribución por nivel del último OLBI**: bajo / a vigilar / alto, con n.

Estado a resolver: semana 1 del estudio (casi todo vacío, sin detecciones, sin circuito): que la página siga pareciendo un estado y no un error.

### 2. Derivaciones — el circuito de apoyo

Aquí se mide si el sistema **responde a tiempo** a lo que detecta. Dos vistas en pestañas:

- **Por caso**: una tabla donde cada fila es una derivación (código, empresa, psicólogo asignado, origen: automática / solicitada, estado: abierta / cerrada) y, en columnas, el **tiempo en días** de cada tramo del circuito: detección → derivación, derivación → cita confirmada, cita → primera sesión, sesión → informe aprobado. Cada celda es un pequeño chip con el número de días; en tierra si supera el límite del protocolo (2 días para confirmar cita, 7 para primera sesión). Encima de la tabla, la **mediana de cada tramo** en cuatro cifras grandes con su n y, al lado, cuántos casos están fuera de rango. Acciones por fila: ver ficha, reasignar psicólogo.
- **Por psicólogo**: una tarjeta por psicólogo (nombre profesional sí, es personal del estudio) con casos abiertos, mediana de días a primera sesión, citas por estado (solicitadas / confirmadas / canceladas / realizadas) como una barra segmentada, y una lista compacta de sus casos abiertos más antiguos. Botón «Reasignar todos sus casos» para cuando un psicólogo deja el estudio.

Un panel lateral opcional: **Citas por estado** en el rango del filtro, con la tasa de cancelación.

Estado a resolver: derivación sin psicólogo disponible (nadie activo) — debe verse como alerta de operación, en ámbar, con la acción «Asignar».

### 3. Auditoría — quién vio la identidad de quién

Registro de **accesos a identidad**: cada vez que un psicólogo o el propio investigador abrió el nombre real de un participante. Es la evidencia ética de la tesis.

- Filtros arriba: por psicólogo (o «investigador»), por participante (código), por rango de fechas, por motivo. Botón «Exportar CSV» que respeta los filtros.
- Tabla: fecha · hora, quién (rol y nombre profesional), participante (código), motivo declarado, derivación asociada (sí / no). Fila en ámbar cuando el acceso ocurrió **sin derivación abierta** (posible acceso indebido) — es lo que el investigador tiene que revisar.
- Un resumen arriba: accesos en el periodo, cuántos sin derivación, participantes distintos consultados, psicólogo con más accesos.
- Debajo, plegable, el **registro de exportaciones del dataset** (mismo formato que en Exportación) y el de **cambios de versión del modelo**, porque también son auditoría.

Estado a resolver: sin accesos en el periodo («nadie ha consultado una identidad»), que es lo deseable y debe leerse como buena noticia.

### 4. Empresas — maestro con umbrales

Lista de empresas participantes con: nombre, participantes (activos / total), administradores, adherencia, fecha de alta; acción «Gestionar». Formulario compacto para agregar una empresa.

Lo nuevo y lo que importa aquí: **umbrales organizacionales**. Una tarjeta destacada «Umbrales del pulso organizacional» con dos filas, *agotamiento* y *desvinculación*, cada una con dos campos editables: **a vigilar** y **alto** (escala 1.0–4.0), la **fuente** (texto: «Peterson et al. (2008), propuesta pendiente de validación del asesor») y la fecha del último cambio. Al editar: vista previa de cuántas empresas quedarían en cada nivel con el nuevo corte, y botón «Guardar umbrales» con confirmación. Solo el investigador puede tocarlos; hay que decirlo en una nota con candado. Validación visible: alto > a vigilar.

Dentro de la ficha de una empresa (**Gestionar**): pestañas Participantes (tabla de códigos con estado, semana, adherencia; acciones: inscribir, restablecer contraseña, dar de baja) y Administradores (lista, crear admin con correo). La acción «Dar de baja» abre un diálogo que explica que las respuestas se conservan anonimizadas.

### 5. Psicólogos — maestro con carga y salida ordenada

Tarjetas o tabla de psicólogos del estudio: nombre profesional, colegiatura, correo, activo / inactivo, **casos abiertos**, citas de la semana, mediana de días a primera sesión. Formulario para crear psicólogo (nombre, colegiatura, correo) que genera una contraseña temporal mostrada una sola vez en un panel con botón «Copiar»; acción «Restablecer contraseña» por fila.

Lo delicado: **desactivar a un psicólogo con casos abiertos**. Al pulsarlo se abre un diálogo de dos pasos: primero muestra sus casos abiertos (código, empresa, días en curso) y obliga a elegir a quién se reasignan (uno por uno o todos al de menor carga); segundo, confirma. No se puede desactivar dejando casos sin psicólogo.

## Estados que quiero ver resueltos

- Resumen en la semana 1 (vacío digno).
- Derivaciones sin psicólogo activo.
- Auditoría sin accesos en el periodo.
- Umbrales con un valor inválido (alto ≤ a vigilar).
- Desactivar psicólogo con tres casos abiertos.

## Reglas que no se negocian

- **Códigos, nunca nombres de participantes.** Nombres de empresas y de psicólogos sí.
- **Nada del contenido clínico.** Informe y sesión son hitos.
- **Nada rojo** salvo errores técnicos: alto y fuera de rango en tierra, urgencia en ámbar.
- Toda cifra con su n; toda fórmula visible o a un clic (ⓘ).
- Densidad alta pero legible: 13 px mínimo en tablas, números tabulares, cabeceras fijas.

## Sistema visual (ya existe; respétalo)

- Inter (400 / 500 / 600). Verde azulado primario #0F766E, profundo #005C55, suave #EFF9F7. Fondo #FAF9F7, superficies blancas con borde #E8E5E0, texto #1C1917 / #57534E / #8A8580.
- Niveles: bajo verde #F0FDF4 / #15803D; a vigilar ámbar #FFFBEB / #B45309; alto tierra #FBF3E6 / #9A5B2B.
- Esquinas 16 px en tarjetas, 999 en pastillas. Monoespaciada para códigos, hashes y fechas-hora. Gráficas sin cuadrícula densa, leyendas en caja.
- Misma barra lateral y barra superior que en las pantallas ya diseñadas; no las reinventes.

## Lo que quiero de ti

Resuelve **Derivaciones** como un tablero de tiempos: que en tres segundos se vea si el circuito está cumpliendo el protocolo y qué caso lo rompe. Resuelve **Auditoría** como evidencia: una tabla que se pueda pegar en un anexo de tesis sin explicación. Y resuelve los dos maestros como herramientas de configuración serias, no como CRUD genérico: los umbrales y la salida de un psicólogo son decisiones con consecuencias y la interfaz debe hacerlas sentir así.
