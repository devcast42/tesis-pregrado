// PDF del resumen para el trabajador — una sola página A4 (o las que hagan
// falta), fuentes estándar de PDF (Helvetica) para no descargar nada.
//
// Las fuentes estándar solo codifican WinAnsi: acentos y eñes van bien, pero
// un emoji o una flecha rompen la generación. Se filtra antes de escribir.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

export type SeccionPdf = { titulo: string; puntos: string[] | { titulo: string; detalle: string }[] }

const ANCHO = 595.28, ALTO = 841.89, MARGEN = 56
const TINTA = rgb(0.13, 0.16, 0.15), MEDIO = rgb(0.38, 0.42, 0.40), ACENTO = rgb(0.16, 0.42, 0.36)

const PERMITIDO = /[^\x20-\x7E -ÿ–—‘’“”•…]/g
const limpiar = (t: string) => t.replace(/[→➔]/g, '-').replace(PERMITIDO, '').replace(/\s+/g, ' ').trim()

function envolver(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const lineas: string[] = []
  for (const parrafo of texto.split('\n')) {
    let linea = ''
    for (const palabra of parrafo.split(' ')) {
      const prueba = linea ? `${linea} ${palabra}` : palabra
      if (fuente.widthOfTextAtSize(prueba, tamano) <= ancho || !linea) linea = prueba
      else { lineas.push(linea); linea = palabra }
    }
    lineas.push(linea)
  }
  return lineas
}

export async function generarPdfResumen(datos: {
  titulo: string
  subtitulo: string
  introduccion: string
  secciones: SeccionPdf[]
  cierre: string
  piePagina: string[]
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(datos.titulo); doc.setProducer('Estudio de bienestar · UNT'); doc.setCreator('Estudio de bienestar · UNT')
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold)
  const anchoUtil = ANCHO - MARGEN * 2

  let pagina: PDFPage = doc.addPage([ANCHO, ALTO])
  let y = ALTO - MARGEN

  const saltoSiHaceFalta = (alto: number) => {
    if (y - alto < MARGEN + 40) { pie(); pagina = doc.addPage([ANCHO, ALTO]); y = ALTO - MARGEN }
  }
  const escribir = (texto: string, opciones: { fuente?: PDFFont; tamano?: number; color?: ReturnType<typeof rgb>; sangria?: number; interlineado?: number } = {}) => {
    const fuente = opciones.fuente ?? normal, tamano = opciones.tamano ?? 10.5, sangria = opciones.sangria ?? 0
    const inter = opciones.interlineado ?? tamano * 1.45
    for (const linea of envolver(limpiar(texto), fuente, tamano, anchoUtil - sangria)) {
      saltoSiHaceFalta(inter)
      pagina.drawText(linea, { x: MARGEN + sangria, y: y - tamano, size: tamano, font: fuente, color: opciones.color ?? TINTA })
      y -= inter
    }
  }
  const pie = () => {
    let yp = MARGEN - 8
    for (const linea of [...datos.piePagina].reverse()) {
      for (const l of envolver(limpiar(linea), normal, 8, anchoUtil).reverse()) {
        pagina.drawText(l, { x: MARGEN, y: yp, size: 8, font: normal, color: MEDIO }); yp += 11
      }
    }
  }

  // Cabecera
  pagina.drawRectangle({ x: MARGEN, y: y - 3, width: 36, height: 3, color: ACENTO })
  y -= 16
  escribir(datos.titulo, { fuente: negrita, tamano: 20, interlineado: 26 })
  escribir(datos.subtitulo, { tamano: 10, color: MEDIO, interlineado: 18 })
  y -= 8
  escribir(datos.introduccion, { tamano: 10.5, color: MEDIO })
  y -= 10

  for (const seccion of datos.secciones) {
    if (seccion.puntos.length === 0) continue
    saltoSiHaceFalta(40)
    y -= 6
    escribir(seccion.titulo.toUpperCase(), { fuente: negrita, tamano: 9, color: ACENTO, interlineado: 16 })
    for (const punto of seccion.puntos) {
      if (typeof punto === 'string') {
        saltoSiHaceFalta(16)
        pagina.drawText('•', { x: MARGEN + 4, y: y - 10.5, size: 10.5, font: normal, color: ACENTO })
        escribir(punto, { sangria: 16 })
        y -= 3
      } else {
        saltoSiHaceFalta(30)
        escribir(punto.titulo, { fuente: negrita, tamano: 10.5, interlineado: 15 })
        escribir(punto.detalle, { color: MEDIO })
        y -= 6
      }
    }
    y -= 4
  }

  y -= 6
  saltoSiHaceFalta(40)
  pagina.drawRectangle({ x: MARGEN, y: y - 1, width: anchoUtil, height: 0.6, color: rgb(0.85, 0.87, 0.86) })
  y -= 12
  escribir(datos.cierre, { tamano: 10, color: MEDIO })
  pie()

  return await doc.save()
}
