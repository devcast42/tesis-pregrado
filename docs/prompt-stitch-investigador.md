# Prompt para Stitch — Panel del investigador

Stitch genera **una pantalla por vez**. Pega primero el **Prompt base** (define
el estilo), y después el prompt de cada pantalla en una generación nueva.
Si Stitch pierde el estilo entre pantallas, vuelve a pegar el bloque de
"Sistema visual" al inicio del prompt de pantalla.

---

## Prompt base (pegar primero)

```
Diseña un panel web de escritorio para un estudio académico de investigación
sobre detección temprana de burnout en profesionales del sector tecnológico.
El usuario es el investigador: revisa indicadores del estudio y administra
empresas, psicólogos y participantes. Idioma: español (España/Perú neutro).

SISTEMA VISUAL

Paleta cálida y apagada, nunca corporativa saturada. Esta herramienta trata
sobre agotamiento laboral: debe leerse como cuidado clínico y rigor académico,
no como un panel de recursos humanos.

- Fondo de página: #FAF9F7 (blanco cálido)
- Superficie de tarjeta: #FFFFFF
- Superficie suave / deshabilitada: #F5F4F1
- Texto principal: #1C1917
- Texto secundario: #57534E
- Texto terciario / metadatos: #8A8580
- Borde sutil: #E8E5E0
- Borde de campo: #D6D2CC
- Color primario (verde azulado): #0F766E
- Primario oscuro (hover): #115E59
- Primario suave (fondo de item activo): #EFF9F7
- Éxito: #15803D sobre #F0FDF4
- Alerta: #B45309 sobre #FFFBEB
- Peligro: #B4413C sobre #FEF2F2

TIPOGRAFÍA
Fuente sans-serif del sistema (Inter o similar), nunca decorativa.
- Título de pantalla: 27px / 34px, peso 600, letter-spacing -0.4px
- Título de sección: 20px / 27px, peso 600
- Cuerpo: 16px / 24px, peso 400
- Cuerpo fuerte: 16px / 24px, peso 500
- Apoyo / nota: 14px / 21px, peso 400, color #8A8580
- Etiqueta de campo: 12px / 16px, peso 600, MAYÚSCULAS, letter-spacing 0.6px,
  color #8A8580
- Cifra grande: 34px / 40px, peso 600, letter-spacing -1px

FORMA Y ESPACIO
- Escala de espaciado múltiplo de 4: 4, 8, 12, 16, 24, 32, 48
- Radios: 8px (chico), 12px (medio), 16px (grande), 20px (extra)
- Tarjetas: fondo blanco, radio 16px, borde 1px #E8E5E0, sombra muy tenue
  (0 2px 12px rgba(28,25,23,0.05)). Nada de sombras marcadas.
- Botones: alto mínimo 52px, radio 12px.
  Primario = relleno #0F766E con texto blanco.
  Secundario = borde 1px #D6D2CC sobre blanco, texto #0F766E.
  Texto = sin fondo ni borde, texto #0F766E.
  Botón pequeño de fila de tabla: alto 38px, radio 8px, texto 14px peso 500.
- Campos de texto: alto mínimo 52px, radio 12px, borde 1px #D6D2CC,
  fondo blanco, placeholder #8A8580. Foco: borde #0F766E.

ESTRUCTURA (idéntica en todas las pantallas)

Barra lateral fija a la izquierda de 232px, fondo #FFFFFF, borde derecho 1px
#E8E5E0, padding vertical 24px y horizontal 12px:
  - Arriba, la marca "ESTUDIO BURNOUT" en etiqueta 12px peso 600 MAYÚSCULAS,
    letter-spacing 0.6px, color #0F766E, con padding horizontal de 12px.
  - Grupo 1 de enlaces (sin encabezado): Resumen · Participantes · Derivaciones
  - Grupo 2 con el encabezado "Maestros" en estilo etiqueta color #8A8580:
    Empresas · Psicólogos · Auditoría
  - Al pie, separado por un borde superior 1px #E8E5E0: "Cerrar sesión"
  - Cada enlace: alto 42px, radio 8px, padding horizontal 12px, texto 16px
    color #57534E. El activo lleva fondo #EFF9F7 y texto #0F766E peso 600.

Área de contenido a la derecha: fondo #FAF9F7, contenido con ancho máximo de
960px, padding de 24px, y bloques separados por 24px verticales.

Cada pantalla empieza con un título grande y, debajo, un párrafo de una o dos
líneas en color #57534E que explica qué es y por qué. Ese párrafo es parte del
diseño, no relleno: el panel enseña mientras se usa.

Las tablas no llevan fondo de cabecera ni bordes verticales. Solo: fila de
encabezado en estilo etiqueta (12px, MAYÚSCULAS, #8A8580) con un borde
inferior 1px #D6D2CC, y cada fila con borde inferior 1px #E8E5E0 y 12px de
padding vertical.

Sin modales, sin menús desplegables de usuario, sin iconos decorativos.
Todo formulario de alta es una fila de campos en línea dentro de una tarjeta,
con su botón a la derecha. Nunca un modal.
```

---

## Pantalla 1 · Resumen

```
Pantalla "Resumen" del panel. Enlace activo en la barra lateral: Resumen.

Título "Estudio". Debajo: "Detección temprana de burnout en profesionales del
sector tecnológico."

1. Tarjeta con tres cifras grandes en fila, cada una con su etiqueta debajo en
   14px color #8A8580: 128 Inscritos · 96 Activos · 14 Detectados.

2. Encabezado de sección en estilo etiqueta: "ADHERENCIA". Tarjeta con tres
   cifras coloreadas: 71 "Al día" en #15803D, 18 "En riesgo" en #B45309,
   7 "Inactivos" en #B4413C. Bajo las cifras, una nota 14px #8A8580:
   "Tasa promedio: 82.4%". Debajo de la tarjeta, un botón secundario de ancho
   completo: "Ver detalle por participante".

3. Sección "INDICADOR 1 · PRECISIÓN DEL MODELO". Tarjeta de fondo suave
   #F5F4F1 con un párrafo en #57534E: "Sin datos: requiere que el modelo de ML
   esté operando junto al método por umbral. Se reporta con recall y F1 porque
   la precisión sola es manipulable —un modelo que casi nunca detecta puede
   alcanzar 100% y no servir de nada."

4. Sección "INDICADOR 2 · VOLUMEN EVALUADO". Tarjeta con una cifra grande 96 y
   la etiqueta "Profesionales en seguimiento activo".

5. Sección "INDICADOR 3 · TIEMPO DE DETECCIÓN". Tarjeta con la cifra "23 d" y
   la etiqueta "Promedio hasta la detección", más una nota 14px #8A8580:
   "14 detectados · 82 censurados a la derecha. Los censurados no son
   negativos: terminaron el seguimiento sin detección y podrían haberse
   detectado después."

6. Sección "PENDIENTES". Tarjeta clicable con dos cifras: 5 "Derivaciones
   abiertas" · 2 "Informes sin revisar".
```

---

## Pantalla 2 · Participantes

```
Pantalla "Participantes" del panel. Enlace activo: Participantes.

Título "Participantes". Párrafo: "Ordenados por adherencia. Conviene contactar
a quien lleve varios días sin responder: un hueco detectado hoy se recupera con
una llamada; detectado al cerrar el estudio, ya no."

Tabla de ancho completo, sin nombres de personas. Columnas:
Código (90px) · Empresa (flexible) · Adherencia (130px) · Tasa (80px) ·
Sin check-in (110px) · OLBI (70px) · Detección (110px).

La columna Adherencia va en texto de 16px peso 500 y color según el estado:
"Al día" #15803D, "En riesgo" #B45309, "Inactivo" #B4413C.
Los valores ausentes se muestran como "—" en color #8A8580.

Ocho filas de ejemplo, por ejemplo:
P-001 · Nexa Software · Al día · 94% · 0 d · 3 · —
P-014 · Nexa Software · En riesgo · 61% · 4 d · 2 · 21 d
P-027 · Andes Digital · Inactivo · 28% · 12 d · 1 · —
P-033 · Andes Digital · Al día · 88% · 1 d · 3 · —

Al pie, una nota 14px #8A8580: "Ningún dato de esta tabla permite identificar a
una persona. Para contactar a quien está en riesgo de abandono hay que pasar
por el administrador de su empresa."
```

---

## Pantalla 3 · Derivaciones

```
Pantalla "Derivaciones" del panel. Enlace activo: Derivaciones.

Título "Derivaciones". Párrafo: "Cada detección abre una derivación al
psicólogo con menos casos abiertos. Una derivación que lleva semanas abierta es
una señal de proceso, no de diagnóstico."

Tarjeta con tres cifras en fila: 5 "Abiertas" · 9 "Cerradas" · "12 d"
"Promedio hasta el cierre".

Tabla con columnas: Código (90px) · Psicólogo (flexible) · Abierta (130px) ·
Estado (150px).
En Estado, las cerradas van en #15803D ("Cerrada en 8 d"), las abiertas
recientes en #1C1917 ("Abierta hace 3 d") y las abiertas hace más de 14 días en
#B45309 ("Abierta hace 21 d"). Texto de 16px peso 500.

Seis filas de ejemplo con fechas del tipo "03 set. 2026".

Nota al pie: "Solo el psicólogo asignado puede cerrar una derivación, y solo
desde su propia pantalla de caso."
```

---

## Pantalla 4 · Empresas

```
Pantalla "Empresas" del panel. Enlace activo: Empresas (bajo "Maestros").

Título "Empresas". Párrafo: "Cada empresa agrupa a sus participantes y a sus
administradores."

Tarjeta con un formulario en línea: un campo de texto ancho con placeholder
"Nombre de la empresa" y, a su derecha, un botón primario "Agregar" en estado
deshabilitado (opacidad 0.4) porque el campo está vacío.

Tabla con columnas: Empresa (flexible) · Creada (120px) · una última columna
sin encabezado con un botón secundario pequeño "Gestionar" (alto 38px).
Cuatro filas: Nexa Software · 12/8/2026; Andes Digital · 3/9/2026;
Lumen Labs · 4/9/2026; Cordillera Tech · 4/9/2026.

Nota al pie: "Para agregar participantes o administradores, entra a una
empresa."
```

---

## Pantalla 5 · Detalle de empresa (la más importante)

```
Pantalla de detalle de una empresa. Enlace activo en la barra lateral:
Empresas.

Encabezado: título "Nexa Software" y, justo debajo, tres cifras grandes en
fila con sus etiquetas: 42 Inscritos · 38 En seguimiento · 2 Administradores.

Debajo, una fila de pestañas de texto sobre un borde inferior 1px #E8E5E0:
"Participantes" y "Administradores". La pestaña activa (Participantes) lleva
el texto en #0F766E peso 500 y un subrayado de 2px en #0F766E que solo cubre
esa pestaña; la inactiva va en #57534E sin subrayado.

Contenido de la pestaña Participantes:

1. Tarjeta con formulario en línea: campo "Nombre y apellido", campo "Correo"
   y botón primario "Inscribir" a la derecha, deshabilitado.

2. Bajo el formulario, dentro de la misma tarjeta, un bloque de credenciales
   recién generadas: fondo #F0FDF4, borde 1px #BBF7D0, radio 16px, padding
   16px. Contiene la etiqueta "CORREO" (12px MAYÚSCULAS #8A8580) con el valor
   "persona@nexa.com" en 18px peso 500, luego la etiqueta "CONTRASEÑA" con el
   valor "nube-cedro-duna-737" en 18px peso 500, y al final una nota 14px
   #57534E: "Entrégasela junto con el consentimiento informado. No se vuelve a
   mostrar."

3. Tabla SIN columna de nombre. Columnas: Código (90px) · Consentimiento
   (140px) · Participación (185px) · última columna sin encabezado con un
   botón secundario pequeño "Restablecer clave".
   En Consentimiento: "Aceptado" en #1C1917, "Pendiente" y "Rechazado" en
   #8A8580. En Participación: "Al día" en #1C1917; "3 días sin responder",
   "Sin responder aún" y "Fuera de seguimiento" en #8A8580.
   Cinco filas de ejemplo (P-001 … P-005).

4. Nota al pie en 14px #8A8580: "Aquí no aparecen nombres: el investigador
   trabaja con códigos anónimos. Los nombres solo los ve el administrador de la
   empresa, que es quien gestiona las cuentas. Y «fuera de seguimiento» no
   distingue el motivo —puede haber terminado, retirado su consentimiento o
   pasado a acompañamiento— porque el motivo es información clínica."
```

Variante de la misma pantalla con la otra pestaña activa:

```
La misma pantalla de detalle de empresa, pero con la pestaña
"Administradores" activa (subrayada en #0F766E) y "Participantes" inactiva.

Contenido:
1. Un párrafo en #57534E sobre el formulario: "Un administrador gestiona las
   cuentas de su empresa. No accede a respuestas, puntajes ni derivaciones."
2. Tarjeta con formulario en línea: campo "Nombre y apellido", campo "Correo",
   botón primario "Crear" deshabilitado.
3. Tabla con columnas: Nombre (flexible) · Estado (120px). Dos filas:
   "Ana Torres · Activo" y "Diego Salas · Activo". Los inactivos irían en
   #8A8580.
```

---

## Pantalla 6 · Psicólogos

```
Pantalla "Psicólogos" del panel. Enlace activo: Psicólogos (bajo "Maestros").

Título "Psicólogos". Párrafo: "Atienden casos de cualquier empresa del estudio.
Las derivaciones se asignan automáticamente al que tenga menos casos abiertos."

Tarjeta con un formulario en línea de tres campos con etiqueta encima en estilo
etiqueta (12px MAYÚSCULAS #8A8580): "NOMBRE" (campo ancho, placeholder "Nombre
y apellido"), "CORREO" (campo ancho, placeholder "correo@ejemplo.com") y
"COLEGIATURA" (campo angosto de 160px, placeholder "CPsP 00000"). A la derecha,
alineado al fondo de la fila, un botón primario "Crear" deshabilitado.

Tabla con columnas: Nombre (flexible) · Colegiatura (140px) · Casos abiertos
(140px) · Estado (100px) · última columna sin encabezado con un botón
secundario pequeño "Restablecer clave".
En "Casos abiertos", el valor 0 va en #8A8580 y los demás en #1C1917.
Tres filas de ejemplo.

Nota al pie: "Dar de baja a un psicólogo con casos abiertos requiere
reasignarlos primero; por ahora se hace desde la base de datos."
```

---

## Pantalla 7 · Auditoría

```
Pantalla "Auditoría" del panel. Enlace activo: Auditoría (bajo "Maestros").

Título "Auditoría". Párrafo largo en #57534E: "Cada vez que un psicólogo revela
el nombre y el correo de un participante derivado, queda este registro. Es el
contrapeso de haber separado identidad y datos de investigación: la separación
se puede levantar, pero nunca en silencio."

Tabla con columnas: Momento (200px) · Psicólogo (flexible) · Participante
(120px). Seis filas con momentos del tipo "03 set. 2026, 11:43 p. m.".

Nota al pie: "Se muestran los últimos 200 accesos. El registro completo vive en
la tabla de eventos y no se puede borrar desde la aplicación."
```

---

## Extra · Estados que conviene pedirle aparte

```
Genera la misma pantalla de Empresas pero con la tabla vacía: en lugar de
filas, un bloque centrado con 32px de padding vertical y el texto en 16px
color #8A8580: "Todavía no hay empresas registradas."
```

```
Genera la pantalla de Empresas en un navegador angosto (menos de 1024px de
ancho): la barra lateral desaparece y se convierte en una barra horizontal
superior desplazable, con los mismos enlaces en fila (Resumen, Participantes,
Derivaciones, Empresas, Psicólogos, Auditoría, Cerrar sesión), fondo blanco,
borde inferior 1px #E8E5E0, cada enlace de alto 40px y padding horizontal 16px.
El contenido pasa a ocupar todo el ancho debajo.
```
