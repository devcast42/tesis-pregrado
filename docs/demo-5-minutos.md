# Demostración de 5 minutos

Guion para presentar el sistema. Cada bloque tiene su tiempo; si uno se alarga,
el que se sacrifica es el último.

Los datos los crea `supabase/semilla_demo_presentacion.py`, que **borra todo y
deja cuatro empresas** en distintos momentos del estudio. No son datos del
estudio real y conviene decirlo en voz alta una vez, al principio.

| Empresa | Personas | Semanas | Por qué está |
|---|---|---|---|
| Nexa Software | 22 | 6 | la cohorte madura, con historia completa |
| Andes Data Labs | 16 | 4 | más carga: infraestructura y guardias, más detecciones |
| Marea Studio | 13 | 6 | buen clima: casi ninguna detección |
| Kuntur Fintech | 7 | 2 | **por debajo del mínimo de reporte**: el panel no puede mostrarle agregados |

---

## Antes de empezar (5 minutos, no cuentan)

```bash
source ~/.zshrc
modelo/exploracion/venv/bin/python supabase/semilla_demo_presentacion.py
cd app-participante && npx expo start --web --port 8081
```

Deja **cuatro pestañas abiertas y con sesión iniciada**, en este orden:

| # | Pestaña | Cuenta | Contraseña |
|---|---|---|---|
| 1 | `localhost:8081/hoy` | `user.prueba2@gmail.com` (es NX-01) | la de `duna-…` |
| 2 | `localhost:8081/psicologo` | `test+psicologo@tesis.local` | `Test1234!` |
| 3 | `localhost:8081/investigador` | `test+investigador@tesis.local` | `Test1234!` |
| 4 | `localhost:8081/admin` | `test+admin@tesis.local` | `Test1234!` |

En la pestaña 3 el selector de empresa de arriba a la izquierda es tu amigo:
déjalo en «Todas las empresas» para el panorama y filtra por una cuando quieras
entrar al detalle.

> Cada rol necesita su propia sesión. Si entras con otra cuenta en la misma
> pestaña, cierras la anterior. Por eso van cuatro pestañas y no una.

---

## 0:00 – 0:40 · El problema, en una frase

> «El OLBI detecta burnout cuando ya está instalado. La tesis pregunta si se
> puede ver venir antes, con señales baratas que la persona da todos los días.»

**Pestaña 1.** Muestra la pantalla Hoy y entra al check-in. Responde dos o tres
preguntas en vivo mientras hablas y envíalo.

Lo que debe quedar: **son 35 segundos al día**, no un cuestionario clínico.

---

## 0:40 – 1:20 · Lo que el participante recibe

Al enviar, aparece el cierre del día. Señala dos cosas:

- La **probabilidad** de que el viernes salga alto, con su nivel de confianza.
  Es el modelo hablando, antes de que el instrumento se aplique.
- **No hay puntaje, ni racha, ni reproche.** Es una decisión de diseño ética,
  no un olvido.

> «Esta probabilidad sale de un modelo preentrenado con 235 personas de un
> estudio publicado, así que funciona desde el primer día, antes de tener datos
> propios.»

---

## 1:20 – 2:50 · El circuito de apoyo (el bloque fuerte)

**Pestaña 2.** La bandeja del psicólogo muestra cuatro casos, cada uno en una
etapa distinta del circuito. Léelos de arriba abajo: es el recorrido completo.

| Caso | Etapa |
|---|---|
| NX-15 | cita pedida, falta confirmar |
| NX-16 | cita confirmada, sala por abrir |
| NX-14 | detectado, aún sin contacto |
| **NX-17** | **sesión hecha, informe por aprobar** |

Abre **NX-17 → «Revisar nota»**. Aquí está el núcleo:

1. La sesión se grabó **solo con el consentimiento de ambos**.
2. Despliega **«Transcripción de la sesión»**: se transcribió automáticamente.
3. El borrador está **organizado en secciones** — lo que se conversó, acuerdos,
   citas textuales.
4. Señala el aviso: **«el participante nunca lo ve»**, y que cada sección es
   editable.
5. Pulsa **«Aprobar informe»**. Al aprobar, el caso se cierra.

> «El modelo organiza lo que se dijo. No diagnostica, no clasifica severidad: el
> esquema de salida no tiene dónde ponerlo. Quien firma es el psicólogo.»

---

## 2:50 – 4:10 · El panel del investigador

**Pestaña 3**, con el filtro en Nexa Software.

- **Resumen** — 18 participantes, adherencia, detecciones. Una foto de la cohorte.
- **Participantes → NX-17** — abre la ficha. Enseña la **trayectoria OLBI**: se ve
  la subida semana a semana hasta cruzar el umbral. Esto es lo longitudinal.
- **Desempeño** — cómo le fue al modelo: precisión, recall, curva. Di el número
  honesto: *«con esta muestra el intervalo es ancho; el análisis de potencia está
  en la especificación»*.
- **Exportación** — el dataset reproducible, con diccionario de variables y hash.

> «Todo lo que ve el investigador está seudonimizado. NX-17 es un código; para
> ver la identidad hay que pedirla, y queda registrado en la auditoría.»

---

## 4:10 – 4:45 · Lo que ve la empresa

**Pestaña 4.** El panel del administrador de Nexa Software.

- Pulso agregado, factores de trabajo, participación.
- **Ningún nombre, ningún caso individual.** Mínimo de 10 personas para reportar.

> «La empresa recibe un diagnóstico organizacional. Nunca sabe quién está mal.
> Sin esa garantía nadie responde con sinceridad, y el estudio no sirve.»

---

## 4:45 – 5:00 · Cierre

Tres frases:

1. Lo que funciona hoy: recolección, detección por umbral, circuito de apoyo
   completo con informe asistido, y los tres paneles.
2. Lo que falta: **participantes**. Con 20 personas ya se entrena el modelo con
   datos propios; con 60 sale el capítulo de resultados.
3. Lo que está decidido y documentado: la formulación, las variables, y un
   análisis de potencia hecho **antes** de reclutar.

---

## Si preguntan

**«¿Los datos son reales?»**
No. Son una cohorte simulada con un proceso de tres niveles calibrado contra un
estudio publicado. Está en `modelo/simular.py` y las estadísticas se comparan
contra la referencia. Ningún número que se vea hoy es un resultado.

**«¿Por qué predecir el OLBI desde preguntas del OLBI no es circular?»**
Es la crítica correcta y está asumida: son cuatro ítems en versión diaria, escala
1–5, frente a un instrumento de 16 en escala 1–4 aplicado otro día. Además el
entrenamiento reporta una versión **sin** ítems de ánimo —solo sueño, horas y
recuperación— justamente para medir cuánto depende de ello.

**«¿Qué pasa si el modelo se equivoca?»**
Se prioriza el recall: es peor no llamar a alguien que se está quemando que tener
una conversación de más. Con eso, dos de cada tres avisos son falsos positivos, y
está declarado como limitación.

**«¿Cuánto cuesta operarlo?»**
Centavos por sesión. La transcripción y la redacción del informe usan servicios
por uso; el resto corre en la capa gratuita.

---

## Después

```bash
modelo/exploracion/venv/bin/python supabase/semilla_demo_presentacion.py --limpiar
```

Retira la cohorte y la empresa sin tocar nada más. El participante que prestó su
cuenta vuelve a quedar como estaba.
