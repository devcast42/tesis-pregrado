# Demostración de 5 minutos

Guion para presentar el sistema. Cada bloque tiene su tiempo; si uno se
alarga, el que se sacrifica es el último.

Los datos los crea `supabase/semilla_demo_presentacion.py`, que **borra todo y
deja cuatro empresas** en distintos momentos del estudio. No son datos del
estudio real y conviene decirlo en voz alta una vez, al principio.

| Empresa | Prefijo | Personas | Semanas | Por qué está |
|---|---|---|---|---|
| Nexa Software | `NEX` | 22 | 6 | la cohorte madura, con historia completa |
| Andes Data Labs | `AND` | 16 | 4 | más carga: infraestructura y guardias, más detecciones |
| Marea Studio | `MAR` | 13 | 6 | buen clima: ninguna detección |
| Kuntur Fintech | `KUN` | 7 | 2 | **por debajo del mínimo de reporte**: el panel no puede mostrarle agregados |

Los códigos llevan las letras de su empresa y miden seis: `NEX-001`,
`AND-014`. El prefijo se fija al crear la empresa, así que al inscribir a
alguien ya se sabe cómo se va a llamar.

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
| 1 | `localhost:8081/hoy` | `user.prueba2@gmail.com` (es NEX-001) | la de `duna-…` |
| 2 | `localhost:8081/psicologo` | `test+psicologo@tesis.local` | `Test1234!` |
| 3 | `localhost:8081/investigador` | `test+investigador@tesis.local` | `Test1234!` |
| 4 | `localhost:8081/admin` | `test+admin@tesis.local` | `Test1234!` |

Es `Test1234!`, con «Test», no «Tesis».

En la pestaña 3 el selector de empresa de arriba a la izquierda es tu amigo:
déjalo en «Todas las empresas» para el panorama y filtra por una cuando
quieras entrar al detalle.

> Cada rol necesita su propia sesión. Si entras con otra cuenta en la misma
> pestaña, cierras la anterior. Por eso van cuatro pestañas y no una.

> La sesión caduca a la hora. Si una pantalla te manda al formulario de
> acceso, es eso: vuelve a entrar. Antes se quedaba en ceros sin avisar.

---

## 0:00 – 0:40 · El problema, en una frase

> «El OLBI detecta burnout cuando ya está instalado. La tesis pregunta si se
> puede ver venir antes, con señales baratas que la persona da todos los días.»

**Pestaña 1.** Muestra la pantalla Hoy y entra al check-in. Responde dos o tres
preguntas en vivo mientras hablas y envíalo.

El check-in de hoy está sin responder a propósito: la semilla se lo salta a
quien presta su cuenta. Los demás sí lo tienen, para que la semana en curso no
salga vacía.

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

**Pestaña 2.** La bandeja del psicólogo muestra los casos, cada uno en una
etapa distinta del circuito. Léelos de arriba abajo: es el recorrido completo.

| Caso | Empresa | Etapa |
|---|---|---|
| AND-014 | Andes Data Labs | detectado, aún sin contacto |
| AND-015 | Andes Data Labs | cita confirmada, sala por abrir |
| NEX-022 | Nexa Software | cita pedida, falta confirmar |
| **NEX-021** | **Nexa Software** | **sesión hecha, informe por aprobar** |
| AND-016 | Andes Data Labs | completo: informe aprobado y caso cerrado |

Abre **NEX-021 → «Revisar nota»**. Aquí está el núcleo:

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

**Pestaña 3**, con el filtro en «Todas las empresas».

- **Resumen** — 53 personas en seguimiento de 58 inscritas, adherencia,
  detecciones. Una foto del estudio.
- **Derivaciones** — los cuatro pasos del circuito con su meta y lo que se
  tarda de verdad. Es el indicador OE2 de la tesis. Señala que 0,0 días de
  «detectar y derivar» no es redondeo: la derivación se crea en el mismo
  evento que la detección.
- **Participantes → NEX-021** — abre la ficha. Enseña la **trayectoria OLBI**:
  se ve la subida semana a semana hasta cruzar el umbral. Esto es lo
  longitudinal.
- **Desempeño** — aquí conviene adelantarse. Lo primero que se ve es el aviso
  en ámbar: *«5 casos reales: las cifras de abajo no concluyen nada»*. Dilo tú
  antes de que lo pregunten: con cinco positivos, precisión y recall se mueven
  decenas de puntos por un solo acierto. El análisis de potencia está en la
  especificación y pide unos veinte.
- **Exportación** — el paquete reproducible, con diccionario de variables y
  hash. Tarda unos segundos en contar: entra un momento antes si vas a
  señalar la cifra.

> «Todo lo que ve el investigador está seudonimizado. NEX-021 es un código;
> para ver la identidad hay que pedirla, y queda registrado en la auditoría.»

Si te sobra tiempo, **Auditoría** lo demuestra en dos clics: abre la identidad
de alguien desde su ficha y enséñala apareciendo en el registro, con hora,
quién y motivo.

---

## 4:10 – 4:45 · Lo que ve la empresa

**Pestaña 4.** El panel del administrador de Nexa Software.

- Pulso agregado, factores de trabajo, participación.
- **Ningún nombre, ningún caso individual.** Mínimo de 10 personas para reportar.

> «La empresa recibe un diagnóstico organizacional. Nunca sabe quién está mal.
> Sin esa garantía nadie responde con sinceridad, y el estudio no sirve.»

Kuntur Fintech es el contraejemplo: 7 personas, por debajo del mínimo. En la
lista de Empresas lo dice en su propia fila. Es una garantía del diseño, no
una carencia.

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

**«¿Por qué la precisión es tan baja?»**
Porque hay cinco casos positivos. Con esa muestra, un acierto de más o de menos
mueve la cifra decenas de puntos: no mide el modelo, mide la falta de datos. Es
justo lo que dice el aviso de la pantalla y lo que cuantifica el análisis de
potencia.

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

Retira las cohortes y las empresas sin tocar cuentas, psicólogos, formularios
ni versiones del modelo. El participante que prestó su cuenta vuelve a quedar
como estaba.

Ojo: al limpiar del todo, el rol de administrador se va con su empresa —un
admin no puede existir sin una—, así que habrá que reasignarlo al crear la
primera empresa real.
