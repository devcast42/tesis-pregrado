// Arranque de la grabación de audio — compartido por token-livekit (al
// entregar un token) e iniciar-grabacion (al registrar un consentimiento).
//
// La grabación depende de tres cosas que pueden llegar en cualquier orden:
// el consentimiento de cada parte y que la sala exista en LiveKit (se crea
// cuando alguien entra). Por eso se intenta en cada uno de esos momentos y
// la función es idempotente: si ya hay egress, no hace nada.
//
// Cada intento deja rastro en `transcripciones` (etapa + detalle) para que
// la pantalla del psicólogo diga en qué paso está o por qué no se grabó.

import { EgressClient, EncodedFileOutput, EncodedFileType, RoomServiceClient, S3Upload } from 'npm:livekit-server-sdk@2'
import type { servicio } from './supabase.ts'

type Db = ReturnType<typeof servicio>
type Sesion = { id: string; sala_livekit: string; consentimiento_trabajador: boolean; consentimiento_psicologo: boolean; finalizada_en: string | null }

export type ResultadoGrabacion = { grabando: boolean; etapa: string; detalle?: string }

const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL')!
const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!

async function anotar(db: Db, sesionId: string, campos: Record<string, unknown>) {
  const dias = Number(Deno.env.get('RETENCION_DIAS') ?? '30')
  const { data: existente } = await db.from('transcripciones').select('id').eq('sesion_id', sesionId).maybeSingle()
  if (existente) await db.from('transcripciones').update(campos).eq('sesion_id', sesionId)
  else await db.from('transcripciones').insert({ sesion_id: sesionId, estado: 'pendiente', borrar_despues_de: new Date(Date.now() + dias * 86_400_000).toISOString(), ...campos })
}

export async function asegurarGrabacion(db: Db, sesion: Sesion): Promise<ResultadoGrabacion> {
  if (!(sesion.consentimiento_trabajador && sesion.consentimiento_psicologo)) {
    return { grabando: false, etapa: 'sin_consentimiento' }
  }
  if (sesion.finalizada_en) return { grabando: false, etapa: 'sin_grabacion', detalle: 'la sesión ya terminó' }

  const { data: actual } = await db.from('transcripciones').select('etapa, audio_ruta').eq('sesion_id', sesion.id).maybeSingle()
  if (actual && actual.etapa !== 'sin_grabacion' && actual.etapa !== 'fallida') {
    return { grabando: true, etapa: actual.etapa }
  }

  if (!Deno.env.get('S3_ACCESS_KEY') || !Deno.env.get('S3_SECRET') || !Deno.env.get('S3_BUCKET')) {
    await anotar(db, sesion.id, { etapa: 'sin_grabacion', detalle: 'almacenamiento de audio no configurado' })
    return { grabando: false, etapa: 'sin_grabacion', detalle: 'almacenamiento de audio no configurado' }
  }

  // La sala existe solo cuando alguien está dentro; sin sala, LiveKit rechaza
  // el egress. Se deja anotado y el siguiente token lo volverá a intentar.
  const salas = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  const abiertas = await salas.listRooms([sesion.sala_livekit]).catch(() => [])
  if (abiertas.length === 0) {
    await anotar(db, sesion.id, { etapa: 'sin_grabacion', detalle: 'esperando a que alguien entre a la sala' })
    return { grabando: false, etapa: 'sin_grabacion', detalle: 'esperando a que alguien entre a la sala' }
  }

  // ¿Ya hay un egress vivo para esta sala? (idempotencia ante dos tokens seguidos)
  const egress = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  const vivos = await egress.listEgress({ roomName: sesion.sala_livekit, active: true }).catch(() => [])
  const rutaAudio = `sesiones/${sesion.id}.ogg`
  if (vivos.length > 0) {
    await anotar(db, sesion.id, { estado: 'procesando', etapa: 'grabando', audio_ruta: rutaAudio, detalle: null })
    return { grabando: true, etapa: 'grabando' }
  }

  try {
    const salida = new EncodedFileOutput({
      fileType: EncodedFileType.OGG,
      filepath: rutaAudio,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: Deno.env.get('S3_ACCESS_KEY')!,
          secret: Deno.env.get('S3_SECRET')!,
          bucket: Deno.env.get('S3_BUCKET')!,
          region: Deno.env.get('S3_REGION') ?? 'us-east-1',
          endpoint: Deno.env.get('S3_ENDPOINT') ?? '',
          forcePathStyle: true,
        }),
      },
    })
    await egress.startRoomCompositeEgress(sesion.sala_livekit, salida, { audioOnly: true })
    await anotar(db, sesion.id, { estado: 'procesando', etapa: 'grabando', audio_ruta: rutaAudio, detalle: null })
    return { grabando: true, etapa: 'grabando' }
  } catch (e) {
    const detalle = `LiveKit no pudo iniciar la grabación: ${e instanceof Error ? e.message : String(e)}`
    console.error(detalle, sesion.id)
    await anotar(db, sesion.id, { etapa: 'sin_grabacion', detalle })
    return { grabando: false, etapa: 'sin_grabacion', detalle }
  }
}
