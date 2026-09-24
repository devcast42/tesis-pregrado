# Modelo de detección temprana (ESP-005)

Todo lo que produce y verifica el modelo. La especificación manda:
[`specs/ESP-005-modelo-de-deteccion.md`](../specs/ESP-005-modelo-de-deteccion.md).

```
exploracion/   datos públicos de referencia y su análisis (§5.1, §5.4)
preentrenar.py w0 desde el diario OLBI de referencia   (§5.2 pasos 1-2)
simular.py     cohorte simulada para probar el pipeline sin datos propios
entrenar.py    entrenamiento y evaluación con datos propios (§5.2 pasos 3-4, §7)
pruebas.py     criterios de aceptación automatizados      (§10)
versiones/     pesos de cada versión del modelo (se cargan en modelo_versiones)
resultados/    informes de evaluación (no son versiones del modelo)
```

El entorno se crea una vez:

```bash
cd modelo/exploracion && python3 -m venv venv && ./venv/bin/pip install pandas scikit-learn scipy "psycopg[binary]" pyreadstat
```

Todo lo que toca la base necesita `SUPABASE_DB_PASSWORD` (`source ~/.zshrc`).

## Flujo

```bash
# 1. Criterios de aceptación: ninguna fuga, censura correcta, SQL == Python
PYTHONPATH=modelo/exploracion modelo/exploracion/venv/bin/python modelo/pruebas.py

# 2. Entrenar y evaluar con los datos del estudio
modelo/exploracion/venv/bin/python modelo/entrenar.py

# 3. Cuando haya muestra suficiente, publicar la versión
modelo/exploracion/venv/bin/python modelo/entrenar.py --publicar
```

`entrenar.py` compara las cuatro versiones de §4.3 (A, B, A₀, B₀) y un random
forest (§6) contra las líneas base de §7.4, todo con las mismas particiones
`GroupKFold` por persona. El preentrenamiento entra como penalización L2
*hacia* `w₀` en los rasgos compartidos y hacia cero en los propios; la fuerza
se elige en validación y queda reportada.

El umbral de decisión se elige con predicciones fuera de muestra dentro del
pliegue de entrenamiento, para los dos modelos. Con predicciones en muestra el
bosque quedaría injustamente mal: las suyas son casi 0/1 y el umbral no
trasladaría a datos nuevos.

## Datos sintéticos

Hay dos conjuntos que **no son del estudio** y que `entrenar.py` excluye por
defecto:

| Prefijo | Origen | Para qué sirve |
|---|---|---|
| `DEMO-*` | `supabase/semilla_demo_empresa.sql` | poblar el panel del empresario |
| `SIM-*` | `modelo/simular.py` | ejercitar el pipeline del modelo |

```bash
modelo/exploracion/venv/bin/python modelo/simular.py --calibrar   # estadísticas, no toca la base
modelo/exploracion/venv/bin/python modelo/simular.py --cargar     # inserta/reemplaza SIM-*
modelo/exploracion/venv/bin/python modelo/simular.py --limpiar    # borra SIM-*
modelo/exploracion/venv/bin/python modelo/entrenar.py --origen simulada
```

`simular.py` genera tres niveles (persona, semana, día) con los parámetros del
estudio de referencia, y el OLBI del viernes lleva **ruido de medición
independiente** del de los ítems diarios. Sin esa separación la etiqueta sería
una función determinista de las entradas y el modelo daría ROC-AUC ≈ 1 sin
haber aprendido nada —el fracaso que describe ESP-005 §1, y que es justo lo
que pasa si se entrena con `DEMO-*`—.

`--calibrar` imprime las estadísticas contra sus referencias para que se vea
si la cohorte sigue siendo verosímil al cambiar parámetros:

| Medida | Simulada | Referencia |
|---|---|---|
| Prevalencia de semanas altas | 0.14 | 0.10–0.25 (ESP-005 §7.3) |
| Media diaria T | 2.08 | 2.23 (Gruszczynska 2021) |
| Desviación diaria T | 0.92 | 0.83 |
| ICC | 0.59 | ≈0.51 |
| Autocorrelación día a día | 0.57 | 0.40–0.60 |

El ICC sale algo alto porque la censura corta el seguimiento de quien cruza, y
eso reduce la variación observada dentro de cada persona.

**Ninguna versión del modelo puede publicarse con estos datos.** `--publicar`
se niega si detecta filas `DEMO-*` o `SIM-*`, y también si hay menos de 20
personas.
