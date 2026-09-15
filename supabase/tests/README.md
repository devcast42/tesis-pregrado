# Pruebas de esquema

Verifican invariantes que, si se rompen, corrompen el estudio en silencio.
No necesitan Supabase: corren contra un PostgreSQL limpio.

## Ejecutar

```bash
docker run -d --name tesis-test -e POSTGRES_PASSWORD=x \
  -v "$PWD/supabase":/sql postgres:17-alpine

# Sustitutos de lo que Supabase provee
docker exec tesis-test psql -U postgres -c "
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql stable as \$\$ select null::uuid \$\$;
  create role authenticated;"

for f in supabase/migrations/*.sql supabase/tests/*.sql; do
  docker exec tesis-test psql -U postgres -v ON_ERROR_STOP=1 -f "/sql/${f#supabase/}"
done

docker rm -f tesis-test
```

> ⚠️ Todos los archivos de esta carpeta salvo `verificar_olbi.sql` **insertan
> datos de prueba**. Correrlos solo contra una base local. Contra el proyecto
> del estudio ensuciarían el dataset con participantes que no existen.

## Qué cubre

| Archivo | Verifica |
|---|---|
| `consulta_invariantes.sql` | ESP-004: sin transcripción lista no hay informe; el borrador es inmutable; no hay aprobación sin psicólogo responsable; borrador y versión aprobada coexisten; una sola derivación abierta por participante |
| `puntajes_olbi.sql` | La media por dimensión y la inversión de ítems. Un ítem inverso mal calculado contamina toda su dimensión sin que nada falle visiblemente |
| `verificar_olbi.sql` | Solo lectura, segura contra el proyecto real: 8 ítems por dimensión, 4 invertidos, ningún texto vacío |
| `olbi_estructura.sql` | Que el instrumento cargado tenga 8 ítems por dimensión con 4 invertidos cada una, ningún texto vacío, y que la **orientación** de la inversión sea correcta: un patrón de burnout máximo debe dar 4,000 en ambas dimensiones y el mínimo 1,000. Si la inversión estuviera al revés, ambos casos darían valores intermedios plausibles |
