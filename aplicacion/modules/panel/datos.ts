/** Maestros del panel — implementa ESP-008.
 *
 *  Toda alta que implique crear una cuenta pasa por una Edge Function: el
 *  cliente no puede crear usuarios. Las lecturas van directas, acotadas por
 *  RLS según quién consulte. */

import { idUsuario, supabase } from '../nucleo/supabase'

export type TamanoEmpresa = '1-50' | '51-200' | '201-1000' | '1000+'
export type ModalidadEmpresa = 'remoto' | 'hibrido' | 'presencial'

/** La ficha de una empresa. Todo menos el nombre es opcional: se da de alta
 *  el día que firma, no el día que se tienen todos sus datos. */
export type DatosEmpresa = {
  nombre: string
  /** Tres letras del código de su gente (AND -> AND-001). Vacío = lo sugiere la base. */
  prefijo?: string | null
  sector?: string | null
  tamano?: TamanoEmpresa | null
  ciudad?: string | null
  modalidad?: ModalidadEmpresa | null
  contacto_nombre?: string | null
  contacto_correo?: string | null
  notas?: string | null
}

export type Empresa = { id: string; nombre: string; creado_en: string } & Omit<DatosEmpresa, 'nombre'>

/** La empresa con sus conteos, tal como aparece en el maestro. */
export type FilaEmpresa = Empresa & {
  trabajadores: number
  en_seguimiento: number
  administradores: number
}

export type ResumenEmpresa = {
  organizacion_id: string
  nombre: string
  inscritos: number
  en_seguimiento: number
  consintieron: number
  respondieron_ayer: number | null
  sin_responder_4d: number | null
  reportable: boolean
}

export type Nivel = 'bajo' | 'a_vigilar' | 'alto'

export type FilaParticipacion = {
  trabajador_id: string
  codigo_anonimo: string
  nombre: string | null
  correo_contacto: string | null
  consentimiento: boolean | null
  en_seguimiento: boolean
  dias_sin_responder: number | null
  /** Días de check-in (lunes a jueves) sin responder: el viernes y el fin de
   *  semana no cuentan, así que nadie sale «callado» un lunes. */
  dias_checkin_sin_responder: number | null
  inscrito_en: string
  /** Producto: la empresa ve el nivel de cada persona, nunca su puntaje. El
   *  número invita a comparar trabajadores, y eso no es lo que se compra. */
  nivel_agotamiento: Nivel | null
  nivel_desvinculacion: Nivel | null
  /** Sí/no, sin fecha ni motivo: que esté en acompañamiento es gestionable;
   *  por qué lo está, no es asunto de la empresa. */
  en_acompanamiento: boolean
  /** Terminó su acompañamiento y aún no ha respondido el cuestionario de
   *  control. Su nivel es de antes y no se enseña. */
  tras_alta: boolean
  ultima_respuesta: string | null
}

export type Administrador = {
  id: string
  auth_user_id: string
  nombre: string
  activo: boolean
}

export type Psicologo = {
  id: string
  auth_user_id: string
  nombre: string
  colegiatura: string
  activo: boolean
}

export type Credenciales = { correo: string; contrasena: string }

// ------------------------------------------------------------------ Empresas

/** Empresa del admin autenticado. El investigador no tiene empresa: devuelve
 *  null. Se lee del servidor porque es la frontera de todo lo que verá. */
export async function miEmpresa(): Promise<Empresa | null> {
  const yo = await idUsuario()
  if (!yo) return null

  const { data: rol } = await supabase
    .from('usuarios_rol')
    .select('organizacion_id')
    .eq('auth_user_id', yo)
    .maybeSingle()
  const id = (rol as { organizacion_id: string | null } | null)?.organizacion_id
  if (!id) return null

  const { data, error } = await supabase
    .from('organizaciones')
    .select('id, nombre, creado_en')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as Empresa | null) ?? null
}

export async function listarEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from('organizaciones')
    .select('id, nombre, creado_en')
    .order('nombre')
  if (error) throw error
  return (data ?? []) as Empresa[]
}

/** Igual que listarEmpresas, con los conteos que pide el maestro. */
export async function listarEmpresasConConteos(): Promise<FilaEmpresa[]> {
  const { data, error } = await supabase
    .from('panel_empresas')
    .select('*')
    .order('nombre')
  if (error) throw error
  return (data ?? []) as FilaEmpresa[]
}

export type EmpresaConResumen = Empresa & {
  inscritos: number
  en_seguimiento: number
  administradores: number
}

/** Empresas con el tamaño de su cohorte y cuántos admins la gestionan.
 *
 *  El segundo renglón de cada fila no es adorno: sin él, cuatro empresas se
 *  ven iguales y no hay forma de saber cuál sostiene el estudio y cuál está
 *  vacía. */
export async function listarEmpresasConResumen(): Promise<EmpresaConResumen[]> {
  const [empresas, resumenes, admins] = await Promise.all([
    listarEmpresas(),
    supabase.from('resumen_empresa').select('organizacion_id, inscritos, en_seguimiento'),
    supabase.from('administradores').select('organizacion_id').eq('activo', true),
  ])
  if (resumenes.error) throw resumenes.error
  if (admins.error) throw admins.error

  type Fila = { organizacion_id: string; inscritos: number; en_seguimiento: number }
  const porEmpresa = new Map(
    ((resumenes.data ?? []) as Fila[]).map((r) => [r.organizacion_id, r]),
  )

  const conteoAdmins = new Map<string, number>()
  for (const a of (admins.data ?? []) as { organizacion_id: string }[]) {
    conteoAdmins.set(a.organizacion_id, (conteoAdmins.get(a.organizacion_id) ?? 0) + 1)
  }

  return empresas.map((e) => ({
    ...e,
    inscritos: porEmpresa.get(e.id)?.inscritos ?? 0,
    en_seguimiento: porEmpresa.get(e.id)?.en_seguimiento ?? 0,
    administradores: conteoAdmins.get(e.id) ?? 0,
  }))
}

export async function crearEmpresa(datos: DatosEmpresa): Promise<Empresa> {
  // Los opcionales vacíos van como null, no como cadena vacía: en la base
  // «no lo sabemos» y «está en blanco» tienen que ser lo mismo.
  const limpio = (v: string | null | undefined) => { const t = (v ?? '').trim(); return t === '' ? null : t }
  const { data, error } = await supabase
    .from('organizaciones')
    .insert({
      nombre: datos.nombre.trim(),
      // Vacío deja que el disparador ponga el sugerido y lo desambigüe.
      prefijo: limpio(datos.prefijo)?.toUpperCase() ?? null,
      sector: limpio(datos.sector),
      tamano: datos.tamano ?? null,
      ciudad: limpio(datos.ciudad),
      modalidad: datos.modalidad ?? null,
      contacto_nombre: limpio(datos.contacto_nombre),
      contacto_correo: limpio(datos.contacto_correo)?.toLowerCase() ?? null,
      notas: limpio(datos.notas),
    })
    .select('id, nombre, prefijo, creado_en, sector, tamano, ciudad, modalidad, contacto_nombre, contacto_correo, notas')
    .single()
  if (error) {
    // 23505 es el índice único sobre lower(nombre).
    const codigo = (error as { code?: string; message?: string }).code
    const msg = (error as { message?: string }).message ?? ''
    if (codigo === '23505') {
      throw new Error(msg.includes('prefijo')
        ? `Las letras «${(datos.prefijo ?? '').toUpperCase()}» ya son de otra empresa.`
        : `Ya hay una empresa llamada «${datos.nombre.trim()}».`)
    }
    if (codigo === '23514' && msg.includes('prefijo')) throw new Error('Las letras deben ser tres, empezando por letra.')
    throw error
  }
  return data as Empresa
}

export async function resumenDeEmpresa(id: string): Promise<ResumenEmpresa | null> {
  const { data, error } = await supabase
    .from('resumen_empresa')
    .select('*')
    .eq('organizacion_id', id)
    .maybeSingle()
  if (error) throw error
  return (data as ResumenEmpresa | null) ?? null
}

/** Participación, nunca salud. La vista no expone el estado real del
 *  trabajador: `detectado`, `retirado` y `finalizado` se ven igual. */
export async function participacionDeEmpresa(id: string): Promise<FilaParticipacion[]> {
  const { data, error } = await supabase
    .from('seguimiento_empresa')
    .select('*')
    .eq('organizacion_id', id)
    .order('codigo_anonimo')
  if (error) throw error
  return (data ?? []) as FilaParticipacion[]
}

// -------------------------------------------------------------------- Admins

export async function listarAdmins(organizacionId: string): Promise<Administrador[]> {
  const { data, error } = await supabase
    .from('administradores')
    .select('id, auth_user_id, nombre, activo')
    .eq('organizacion_id', organizacionId)
    .order('nombre')
  if (error) throw error
  return (data ?? []) as Administrador[]
}

export async function crearAdmin(datos: {
  organizacion_id: string
  correo: string
  nombre: string
}): Promise<Credenciales> {
  return invocar('crear-admin', datos)
}

// ---------------------------------------------------------------- Psicólogos

export async function listarPsicologos(): Promise<Psicologo[]> {
  const { data, error } = await supabase
    .from('psicologos')
    .select('id, auth_user_id, nombre, colegiatura, activo')
    .order('nombre')
  if (error) throw error
  return (data ?? []) as Psicologo[]
}

export async function crearPsicologo(datos: {
  correo: string
  nombre: string
  colegiatura: string
}): Promise<Credenciales> {
  return invocar('crear-psicologo', datos)
}

/** Derivaciones abiertas por psicólogo. Se usa para no derivar siempre al
 *  mismo y para ver de un vistazo quién está saturado. */
export async function cargaDePsicologos(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('derivaciones')
    .select('psicologo_id')
    .is('cerrada_en', null)
  if (error) throw error
  const carga: Record<string, number> = {}
  for (const fila of data ?? []) {
    const id = (fila as { psicologo_id: string }).psicologo_id
    carga[id] = (carga[id] ?? 0) + 1
  }
  return carga
}

// ------------------------------------------------------------- Trabajadores

export async function inscribirTrabajador(datos: {
  organizacion_id: string
  correo: string
  nombre: string
}) {
  return invocar<{ codigo_anonimo: string; contrasena: string }>(
    'inscribir-trabajador',
    datos,
  )
}

/** Para psicólogos y admins, cuya ficha ya trae el id de auth. */
export async function restablecerContrasena(authUserId: string) {
  return invocar<{ contrasena: string }>('restablecer-contrasena', {
    auth_user_id: authUserId,
  })
}

/** Para trabajadores: el panel nunca ve ids de auth, los resuelve el servidor. */
export async function restablecerTrabajador(trabajadorId: string) {
  return invocar<{ contrasena: string }>('restablecer-contrasena', {
    trabajador_id: trabajadorId,
  })
}

// ------------------------------------------------------------------- Interno

/** Una Edge Function que falla llega como error genérico; el motivo real viene
 *  en el cuerpo. Sin esto, todo fallo se ve igual y no hay cómo diagnosticar. */
async function invocar<T>(nombre: string, cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nombre, { body: cuerpo })
  if (error) throw new Error(await detalle(error))
  return data as T
}

async function detalle(error: unknown): Promise<string> {
  const contexto = (error as { context?: Response }).context
  if (contexto && typeof contexto.json === 'function') {
    try {
      const cuerpo = await contexto.json()
      if (cuerpo?.error) return String(cuerpo.error)
    } catch {
      try {
        const t = await contexto.text()
        if (t) return t
      } catch { /* sin cuerpo legible */ }
    }
  }
  return error instanceof Error ? error.message : 'Error desconocido'
}

// ------------------------------------------------------- Derivaciones y audit

export type FilaDerivacion = {
  id: string
  codigo_anonimo: string
  psicologo: string
  abierta_en: string
  cerrada_en: string | null
}

/** Derivaciones del estudio. Solo el investigador las ve todas; el psicólogo,
 *  por RLS, solo las suyas. */
export async function listarDerivaciones(): Promise<FilaDerivacion[]> {
  const { data, error } = await supabase
    .from('derivaciones')
    .select('id, abierta_en, cerrada_en, trabajadores(codigo_anonimo), psicologos(nombre)')
    .order('abierta_en', { ascending: false })
  if (error) throw error

  type Cruda = {
    id: string
    abierta_en: string
    cerrada_en: string | null
    trabajadores: { codigo_anonimo: string } | null
    psicologos: { nombre: string } | null
  }

  return ((data ?? []) as unknown as Cruda[]).map((d) => ({
    id: d.id,
    abierta_en: d.abierta_en,
    cerrada_en: d.cerrada_en,
    codigo_anonimo: d.trabajadores?.codigo_anonimo ?? '—',
    psicologo: d.psicologos?.nombre ?? '—',
  }))
}

export type FilaAuditoria = {
  id: number
  codigo_anonimo: string
  psicologo: string
  ocurrido_en: string
}

/** RN-006-03 — cada revelación de identidad deja rastro, y el rastro se mira.
 *  Un registro de auditoría que nadie consulta no disuade a nadie. */
export async function listarAccesosIdentidad(): Promise<FilaAuditoria[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select('id, ocurrido_en, metadata, trabajadores(codigo_anonimo)')
    .eq('tipo', 'acceso_identidad')
    .order('ocurrido_en', { ascending: false })
    .limit(200)
  if (error) throw error

  type Cruda = {
    id: number
    ocurrido_en: string
    metadata: { psicologo_id?: string } | null
    trabajadores: { codigo_anonimo: string } | null
  }
  const crudas = (data ?? []) as unknown as Cruda[]

  // Los eventos guardan el id del psicólogo, no su nombre: se resuelve aquí
  // para no duplicar el dato en la tabla de eventos.
  const nombres = new Map((await listarPsicologos()).map((p) => [p.id, p.nombre]))

  return crudas.map((ev) => ({
    id: ev.id,
    ocurrido_en: ev.ocurrido_en,
    codigo_anonimo: ev.trabajadores?.codigo_anonimo ?? '—',
    psicologo: nombres.get(ev.metadata?.psicologo_id ?? '') ?? '—',
  }))
}
