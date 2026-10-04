# Detección temprana de Burnout — sistema

Sistema de la tesis *Detección temprana del síndrome de Burnout en Profesionales
del Sector Tecnológico mediante Machine Learning* (Universidad Nacional de
Trujillo, Ingeniería de Sistemas).

## Qué hace

Cien profesionales del sector tecnológico responden desde su teléfono un
check-in breve cada día, un resumen semanal y el OLBI cada quince días. El
sistema puntúa el OLBI, y cuando alguien cruza el umbral lo deriva
automáticamente a un psicólogo. La sesión de apoyo ocurre por videollamada
dentro de la misma app; si ambas partes lo autorizan se graba el audio, se
transcribe y se genera un borrador de informe que el psicólogo revisa, corrige
y aprueba.

## Los tres roles

| Rol | Dónde | Qué hace |
|---|---|---|
| **Participante** | App móvil | Consiente, responde los cuatro instrumentos, atiende su sesión de apoyo |
| **Psicólogo** | Misma app (móvil o web) | Ve solo sus casos derivados, atiende la videoconsulta, revisa y aprueba informes |
| **Investigador** | Misma app en web | Inscribe participantes, sigue la adherencia, consulta los tres indicadores de la tesis |

Una sola base de código para los tres. Expo compila a móvil y a web, y el
enrutamiento por rol ocurre tras autenticarse, sin selector manual.

## Estructura

```
specs/          Especificaciones. Nada se implementa sin una previa
docs/           Requisitos y arquitectura
supabase/
  migrations/   Esquema, políticas RLS, vistas de indicadores
  functions/    Edge Functions (Deno)
  tests/        Invariantes verificados contra PostgreSQL
app-trabajador/
  app/          Rutas — solo composición
  modules/      Un módulo por dominio, cada uno con su README
```

## Poner en marcha

### 1. Base de datos

```bash
supabase link --project-ref TU_PROYECTO
supabase db push
```

Las siete migraciones aplican en orden. La séptima siembra los formularios.

### 2. Completar el OLBI

`20260829090500_semilla_formularios.sql` deja el OLBI como plantilla: los textos van
vacíos a propósito. Cópialos del **Anexo 07** de la tesis, que es la versión
validada, y verifica ítem por ítem la dimensión y cuáles son inversos. Un ítem
inverso sin marcar contamina toda su dimensión sin que nada falle a la vista.

Verifica que quedó bien cargado (consulta de solo lectura, segura contra el
proyecto real):

```bash
npx supabase db query --linked --file supabase/tests/verificar_olbi.sql
```

Debe dar 8 ítems por dimensión, 4 invertidos cada una y cero textos vacíos.

> `olbi_estructura.sql` es la prueba completa —verifica también la orientación
> de la inversión— pero **inserta datos de prueba**: correrla solo contra una
> base local, nunca contra el proyecto del estudio.

Los umbrales están en `provisional-v0` y **no tienen respaldo bibliográfico
confirmado**. Sirven para operar el sistema de extremo a extremo; sustitúyelos
por los definitivos antes de recolectar datos reales. Cada detección queda
etiquetada con la versión de umbral usada, así que los puntajes se recalculan
desde los ítems crudos sin volver a recolectar.

### 3. Variables de entorno

```bash
cp supabase/functions/.env.example supabase/functions/.env
cp app-trabajador/.env.example app-trabajador/.env
```

Necesitas cuentas en Supabase, LiveKit Cloud, Deepgram y Anthropic, más un
bucket S3 o Cloudflare R2 para el audio.

### 4. Acceso

El acceso es con **correo y contraseña**. No hay correos de por medio: al
inscribir a alguien, el sistema genera una contraseña legible y se la muestra
una sola vez al investigador, que la entrega junto con el consentimiento
informado.

Se eligió así porque el acceso por código exige un servicio de correo con
dominio verificado, y sin él ningún participante puede entrar — el estudio
quedaría bloqueado por infraestructura ajena a la investigación.

Si alguien pierde su contraseña, el investigador se la restablece desde el
panel de Supabase (**Authentication → Users**).

### 5. Siembra inicial

El estudio es de inscripción cerrada: nadie se registra solo, ni siquiera el
equipo de investigación. Hay que sembrar el primer usuario a mano.

1. En el panel de Supabase: **Authentication → Users → Add user**, con
   *Auto Confirm User* marcado.
2. Edita los tres valores del inicio de `supabase/bootstrap.sql`.
3. Córrelo:

```bash
npx supabase db query --linked --file supabase/bootstrap.sql
```

Crea tu rol de investigador, la primera empresa y, si le pones correo, un
psicólogo. **Sin al menos un psicólogo activo, una detección no se puede
derivar a nadie** y el caso queda sin asignar.

### 6. App

```bash
cd app-trabajador
npm install
npx expo run:ios     # o run:android — requiere dev build, no Expo Go
npx expo start --web # panel de psicólogo e investigador
```

La videollamada usa código nativo, así que **Expo Go no sirve**: hay que
compilar un development build.

### 7. Tareas periódicas

Programar a diario:

- `registrar_alertas_adherencia()` — avisa de participantes que dejaron de responder
- `borrar_datos_vencidos()` — borra audio y transcripciones vencidos

## Lo que falta

**El modelo de machine learning.** Hoy la detección corre por umbral OLBI, que
en el diseño preexperimental es el método tradicional y la línea base del
pretest. Cuando exista el modelo, ambos corren en paralelo y el indicador de
precisión se calcula solo: la vista `indicador_precision` ya compara
`metodo = 'modelo_ml'` contra `metodo = 'olbi_umbral'` y reporta precisión,
recall y F1.

Antes de construirlo, leer [docs/requisitos-y-arquitectura.md](docs/requisitos-y-arquitectura.md)
§5 — hay seis advertencias sobre el diseño del modelo, y la primera invalidaría
dos de los tres objetivos específicos de la tesis si se pasa por alto.

## Decisiones pendientes del asesor

Están al final de cada especificación, en la sección *Decisiones abiertas*. Las
que bloquean trabajo real:

1. Umbrales definitivos del OLBI, con referencia bibliográfica
2. Formulación del modelo: clasificación puntual o predicción de trayectoria
3. Redacción de HE1 — tal como está, es imposible de ganar
4. Duración del seguimiento en días
5. Plazo de retención del audio clínico (comité de ética)
