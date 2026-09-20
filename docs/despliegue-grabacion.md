# Despliegue de la grabación, transcripción e informe (E4 · ESP-004)

Qué hay que hacer para que una sesión de apoyo con doble consentimiento se
grabe en audio, se transcriba y produzca el borrador de informe. El código y
las funciones ya están desplegados; faltan **llaves de tres servicios** y
**un webhook**. Nada de esto se pega en el chat ni en el repositorio: va a
los secretos del proyecto con el comando del paso 5.

## Circuito

```
token-livekit ──(doble consentimiento)──▶ LiveKit egress (solo audio)
      │                                         │ escribe sesiones/<id>.ogg
      │                                         ▼
      │                               Supabase Storage · bucket privado
      │                                    «audio-sesiones»
      │                                         │ webhook egress_ended
      ▼                                         ▼
 transcripciones (procesando)  ◀────────  egress-webhook ──▶ Deepgram (URL firmada 1 h)
                                                                    │ callback + clave
                                                                    ▼
                                                          transcripcion-lista ──▶ redactar-informe (Claude)
                                                                    │                     │
                                                                    ▼                     ▼
                                                          transcripciones (lista)   informes (borrador)
```

Si alguna llave falta, la sesión **igual ocurre**: `token-livekit` devuelve
`grabacion: false` y el psicólogo escribe el informe a mano.

## Paso 1 · Llaves S3 de Supabase Storage (almacenamiento del audio)

El bucket `audio-sesiones` ya existe y es privado (migración
`20260920130000`). LiveKit necesita credenciales S3 para escribir en él:

1. Dashboard de Supabase → **Project Settings → Storage → S3 Access Keys →
   New access key**. Nombre: `livekit-egress`.
2. Guarda el *Access key ID* y el *Secret access key* (solo se muestran una vez).
3. El endpoint y la región aparecen en esa misma pantalla («S3 connection»).
   Para este proyecto: endpoint `https://tnllaabrtntlmobtnhfp.storage.supabase.co/storage/v1/s3`,
   región `us-east-1`.

## Paso 2 · Deepgram (transcripción)

1. Cuenta en <https://console.deepgram.com> (hay crédito gratuito inicial).
2. **API Keys → Create a New API Key**, permiso *Member*. Guarda la clave.
3. Modelo usado: `nova-3`, idioma `es`, con diarización. No hay que configurar
   nada más: el callback va en cada petición.

## Paso 3 · Anthropic (redacción del borrador)

1. Cuenta en <https://console.anthropic.com>, con crédito.
2. **API Keys → Create Key**. Guarda la clave.
3. Modelo usado: `claude-haiku-4-5-20251001` (~USD 0.02 por informe; con USD 5 de crédito alcanza para toda la tesis) (`supabase/functions/redactar-informe/index.ts`).

## Paso 4 · Webhook de LiveKit (aviso de fin de grabación)

1. <https://cloud.livekit.io> → proyecto → **Settings → Webhooks → Add endpoint**.
2. URL: `https://tnllaabrtntlmobtnhfp.supabase.co/functions/v1/egress-webhook`
3. Signing key: la **misma API key** que ya está en los secretos (`LIVEKIT_API_KEY`);
   la función verifica la firma con ella.

## Paso 5 · Cargar los secretos

Genera una clave aleatoria para el callback de Deepgram y carga todo de una
vez (rellena los valores; no dejes este comando en el historial compartido):

```bash
npx supabase secrets set \
  S3_ACCESS_KEY="…" \
  S3_SECRET="…" \
  S3_BUCKET="audio-sesiones" \
  S3_REGION="us-east-1" \
  S3_ENDPOINT="https://tnllaabrtntlmobtnhfp.storage.supabase.co/storage/v1/s3" \
  DEEPGRAM_API_KEY="…" \
  ANTHROPIC_API_KEY="…" \
  WEBHOOK_SECRET="$(openssl rand -hex 24)" \
  RETENCION_DIAS="30"
```

`RETENCION_DIAS` es provisional hasta que el comité fije el plazo (B7).

## Diagnóstico

Dos funciones solo para el investigador (llamarlas con su sesión):

- `s3-diagnostico` — prueba las credenciales S3 del egress y lista el bucket.
  Un `NoSuchBucket` significa que `S3_BUCKET` no es `audio-sesiones`.
- `egress-estado` `{ "sala": "consulta-…" }` — lo que LiveKit sabe de la
  grabación de esa sala: estado, error y archivo subido.

## Paso 6 · Prueba de punta a punta (PB-24 / PB-25)

1. Psicólogo (web) y participante (teléfono) autorizan la grabación y entran a
   la sesión. En la barra del psicólogo debe verse **«Grabando»**; si no,
   revisa los logs de `token-livekit` en el dashboard (Functions → Logs).
2. Hablan un minuto y cuelgan. En Storage debe aparecer `sesiones/<id>.ogg`.
3. En 1–3 minutos: `transcripciones.estado` pasa a `lista` y aparece un
   `informe` en borrador; el psicólogo lo ve en su pantalla de informe.
4. En la ficha del participante (investigador) aparecen los hitos
   `transcripcion_lista` e `informe_generado`, sin contenido.

Comprobación rápida desde SQL:

```sql
select s.id, t.estado, t.generada_en, i.estado as informe
from sesiones_consulta s
left join transcripciones t on t.sesion_id = s.id
left join informes i on i.sesion_id = s.id
order by s.iniciada_en desc limit 5;
```

## Lo que sigue dependiendo del comité (no técnico)

- **PB-28 / RN-004-07**: el texto del consentimiento ya declara LiveKit,
  Deepgram, Anthropic y Supabase (versión `v2-2026-09` en la app); el comité
  debe aprobar esa redacción junto con el resto del texto (B6).
- **PB-27 / B7**: plazo de borrado del audio y la transcripción; luego
  programar `borrar_datos_vencidos()` con ese valor.
