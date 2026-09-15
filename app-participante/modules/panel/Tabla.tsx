/** Tabla y credenciales — piezas compartidas por los maestros. */

import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Tarjeta } from '../nucleo/ui'
import { color, espacio, radio, texto } from '../nucleo/diseno'

export type Columna<T> = {
  titulo: string
  ancho?: number
  flex?: number
  /** La columna de acciones se alinea a la derecha: el botón queda pegado al
   *  borde de la tarjeta y la vista no se llena de botones flotando a media
   *  columna. */
  alinear?: 'izquierda' | 'derecha'
  celda: (fila: T) => ReactNode
}

export function Tabla<T>({
  columnas,
  filas,
  clave,
  vacio,
  nota,
  enTarjeta,
}: {
  columnas: Columna<T>[]
  filas: T[]
  clave: (fila: T) => string
  vacio: string
  /** Nota al pie, separada por una línea. Va DENTRO de la tabla y no suelta
   *  debajo: lo que explica es esta tabla, y a media pantalla de distancia
   *  deja de leerse como su pie. */
  nota?: ReactNode
  /** Envuelve la tabla en una tarjeta. Para tablas que son el contenido
   *  principal de la pantalla; las que ya viven dentro de un bloque no la
   *  necesitan —una tarjeta dentro de otra solo añade ruido. */
  enTarjeta?: boolean
}) {
  const cuerpo =
    filas.length === 0 ? (
      <View style={e.vacio}>
        <Text style={[texto.cuerpo, { color: color.textoSuave }]}>{vacio}</Text>
      </View>
    ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // flexGrow en el contenedor de contenido: dentro de un ScrollView
        // horizontal los hijos se miden por su contenido, así que una columna
        // `flex` colapsaba y la tabla quedaba encogida a la izquierda de la
        // tarjeta en lugar de ocupar su ancho.
        contentContainerStyle={e.contenido}
      >
        <View style={e.tabla}>
          <View style={e.cabecera}>
            {columnas.map((c) => (
              <View key={c.titulo} style={[e.celda, dimension(c), alineacion(c)]}>
                <Text style={[texto.etiqueta, { color: color.textoSuave }]}>{c.titulo}</Text>
              </View>
            ))}
          </View>

          {filas.map((fila) => (
            <View key={clave(fila)} style={e.fila}>
              {columnas.map((c) => (
                <View key={c.titulo} style={[e.celda, dimension(c), alineacion(c)]}>
                  {c.celda(fila)}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    )

  const conNota = (
    <>
      {cuerpo}
      {nota && (
        <View style={e.nota}>
          {typeof nota === 'string'
            ? <Text style={[texto.apoyo, { color: color.textoSuave }]}>{nota}</Text>
            : nota}
        </View>
      )}
    </>
  )

  return enTarjeta ? <Tarjeta>{conNota}</Tarjeta> : conNota
}

function alineacion<T>(c: Columna<T>) {
  return c.alinear === 'derecha' ? { alignItems: 'flex-end' as const } : undefined
}

function dimension<T>(c: Columna<T>) {
  return c.ancho ? { width: c.ancho } : { flex: c.flex ?? 1, minWidth: 120 }
}

/** Las credenciales se muestran UNA vez. Un bloque destacado deja claro que
 *  hay que copiarlas ahora, no después. */
export function Credenciales({
  correo,
  contrasena,
  nota,
}: {
  correo?: string
  contrasena: string
  nota?: string
}) {
  return (
    <View style={e.credenciales}>
      {correo && (
        <>
          <Text style={[texto.etiqueta, e.etiquetaCred]}>Correo</Text>
          <Text style={[texto.cuerpoFuerte, e.valor]} selectable>{correo}</Text>
        </>
      )}
      <Text style={[texto.etiqueta, e.etiquetaCred]}>Contraseña</Text>
      <Text style={[texto.seccion, e.valor]} selectable>{contrasena}</Text>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
        {nota ?? 'Anótala ahora: no se vuelve a mostrar.'}
      </Text>
    </View>
  )
}

export function Celda({
  children, suave, tono, fuerte,
}: {
  children: ReactNode
  suave?: boolean
  /** Color explícito, para estados que se leen de un vistazo. Independiente
   *  del peso: hay columnas que piden color sin pedir negrita. */
  tono?: string
  fuerte?: boolean
}) {
  return (
    <Text
      style={[
        fuerte ? texto.cuerpoFuerte : texto.cuerpo,
        { color: tono ?? (suave ? color.textoSuave : color.texto) },
      ]}
    >
      {children}
    </Text>
  )
}

const e = StyleSheet.create({
  contenido: { flexGrow: 1 },
  tabla: { flexGrow: 1, minWidth: '100%' },
  cabecera: {
    flexDirection: 'row',
    paddingBottom: espacio.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.bordeFuerte,
  },
  fila: {
    flexDirection: 'row',
    paddingVertical: espacio.md,
    borderBottomWidth: 1,
    borderBottomColor: color.borde,
    alignItems: 'center',
  },
  celda: { paddingRight: espacio.base, justifyContent: 'center' },
  vacio: { paddingVertical: espacio.xl },
  nota: {
    marginTop: espacio.base,
    paddingTop: espacio.base,
    borderTopWidth: 1,
    borderTopColor: color.borde,
  },
  credenciales: {
    gap: 2,
    padding: espacio.base,
    borderRadius: radio.lg,
    backgroundColor: color.exitoSuave,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  etiquetaCred: { color: color.textoSuave, marginTop: espacio.sm },
  valor: { color: color.texto },
})
