/** Panel del investigador — implementa ESP-006 RF-006-09.
 *
 *  Los tres indicadores del Anexo 3 se leen de vistas, nunca se recalculan
 *  aquí. Si la app los recalculara habría dos verdades, y la que llegue al
 *  capítulo de resultados sería la que alguien copió a mano.
 *
 *  Lo que esta pantalla NO muestra, y es a propósito:
 *
 *  · Ningún nombre. El investigador trabaja con códigos (RN-006-01).
 *  · Ninguna interpretación clínica del caso. El sistema no la produce, y un
 *    panel que la insinuara invitaría a leerla como diagnóstico
 *    (ESP-004 RN-004-01).
 *  · Ninguna tasa de burnout por empresa. El dato existe; publicarlo en una
 *    lista ordenada convierte el estudio en un ranking de empleadores. */

import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Barra, Bloque, FilaLista, Indicador, Insignia } from '../../modules/panel/Piezas'
import { Celda, Tabla } from '../../modules/panel/Tabla'
import {
  adherenciaPorEmpresa,
  descargarDataset,
  deteccionesRecientes,
  obtenerPrecision,
  obtenerResumen,
  obtenerTiemposDeteccion,
  type AdherenciaEmpresa,
  type DeteccionReciente,
  type Precision,
  type Resumen,
} from '../../modules/investigador/datos'
import {
  Apoyo, Aviso, Boton, Cargando, Cifra, Pantalla, Parrafo, Tarjeta, Titulo,
} from '../../modules/nucleo/ui'
import { ancho, color, espacio, texto } from '../../modules/nucleo/diseno'

export default function PanelInvestigador() {
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [precision, setPrecision] = useState<Precision | null>(null)
  const [tiempos, setTiempos] = useState<{ censurado: boolean }[] | null>(null)
  const [empresas, setEmpresas] = useState<AdherenciaEmpresa[]>([])
  const [detecciones, setDetecciones] = useState<DeteccionReciente[]>([])

  const cargar = useCallback(async () => {
    const [r, p, t, emp, det] = await Promise.all([
      obtenerResumen(),
      obtenerPrecision(),
      obtenerTiemposDeteccion(),
      adherenciaPorEmpresa(),
      deteccionesRecientes(),
    ])
    setResumen(r)
    setPrecision(p)
    setTiempos(t)
    setEmpresas(emp)
    setDetecciones(det)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!tiempos || !resumen) return <Panel rol="investigador"><Cargando /></Panel>

  const detectados = tiempos.filter((t) => !t.censurado).length
  const censurados = tiempos.filter((t) => t.censurado).length

  const conSeguimiento = resumen.al_dia + resumen.en_riesgo + resumen.inactivos + resumen.nunca_inicio
  const porcentajeDetectados =
    resumen.inscritos === 0 ? 0 : (resumen.detectados / resumen.inscritos) * 100
  const totalDerivaciones = resumen.derivaciones_abiertas + resumen.derivaciones_cerradas
  const cobertura =
    totalDerivaciones === 0 ? null : (resumen.derivaciones_cerradas / totalDerivaciones) * 100

  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <Titulo>Resumen del estudio</Titulo>
          <Parrafo suave>
            Seguimiento longitudinal de agotamiento y desvinculación en profesionales del
            sector tecnológico, medido con el OLBI cada quince días y check-ins diarios entre
            medición y medición.
          </Parrafo>
        </View>

        {/* Cifras de cabecera ------------------------------------------- */}
        <View style={e.rejilla}>
          <Indicador
            rotulo="Participantes activos"
            valor={resumen.activos}
            nota={`${resumen.inscritos} inscritos en ${resumen.empresas} ${
              resumen.empresas === 1 ? 'empresa' : 'empresas'
            }`}
          />
          <Indicador
            rotulo="Adherencia promedio"
            valor={
              resumen.adherencia_promedio != null
                ? `${(resumen.adherencia_promedio * 100).toFixed(1)}%`
                : '—'
            }
            nota="Proporción de check-ins diarios respondidos"
          />
          <Indicador
            rotulo="Detectados"
            valor={resumen.detectados}
            tono={color.peligro}
            tonoRotulo={color.peligro}
            nota={`${porcentajeDetectados.toFixed(1)}% del total; deriva a psicólogo al superar el umbral`}
          />
          <Indicador
            rotulo="Derivaciones cerradas"
            valor={resumen.derivaciones_cerradas}
            tonoRotulo={color.exito}
            nota={
              cobertura != null
                ? `${cobertura.toFixed(1)}% de las derivaciones abiertas hasta hoy`
                : 'Todavía no hay derivaciones'
            }
          />
        </View>

        {/* Distribución y empresas -------------------------------------- */}
        <View style={e.rejillaDoble}>
          <Bloque
            ancho={340}
            titulo="Distribución por adherencia"
            descripcion="Segmentación de la muestra según cuánto lleva cada persona sin responder su check-in diario (ESP-007)."
          >
            {conSeguimiento === 0 ? (
              <Apoyo>Todavía no hay participantes en seguimiento.</Apoyo>
            ) : (
              <View style={e.barras}>
                <Barra etiqueta="Al día" cantidad={resumen.al_dia}
                  total={conSeguimiento} tono={color.exito} />
                <Barra etiqueta="En riesgo de abandono" cantidad={resumen.en_riesgo}
                  total={conSeguimiento} tono={color.alerta} />
                <Barra etiqueta="Inactivos" cantidad={resumen.inactivos}
                  total={conSeguimiento} tono={color.peligro} />
                <Barra etiqueta="Nunca iniciaron" cantidad={resumen.nunca_inicio}
                  total={conSeguimiento} tono={color.textoSuave} />
              </View>
            )}
          </Bloque>

          <Bloque
            ancho={340}
            titulo="Adherencia por empresa"
            descripcion="A quién hay que llamar antes de que su cohorte se caiga del estudio."
          >
            {empresas.length === 0 ? (
              <Apoyo>Ninguna empresa tiene participantes en seguimiento todavía.</Apoyo>
            ) : (
              <View>
                {empresas.map((x, i) => {
                  const enPeligro = x.inactivos + x.nunca_iniciaron
                  const tono =
                    enPeligro > 0 ? 'peligro'
                    : x.en_riesgo > 0 ? 'alerta'
                    : 'exito'
                  const rotulo =
                    enPeligro > 0 ? 'Requiere contacto'
                    : x.en_riesgo > 0 ? 'En seguimiento'
                    : 'Al día'
                  return (
                    <FilaLista
                      key={x.organizacion_id}
                      titulo={x.nombre}
                      detalle={`${x.participantes_activos} en seguimiento · ${
                        x.tasa_promedio != null
                          ? `${(x.tasa_promedio * 100).toFixed(0)}% de adherencia`
                          : 'sin datos aún'
                      }`}
                      insignia={rotulo}
                      tono={tono}
                      ultima={i === empresas.length - 1}
                    />
                  )
                })}
              </View>
            )}
          </Bloque>
        </View>

        {/* Indicadores del Anexo 3 -------------------------------------- */}
        <Bloque
          titulo="Indicadores del estudio"
          descripcion="Los tres del Anexo 3. Se leen de vistas de la base; esta pantalla no los recalcula."
        >
          <View style={e.indicadores}>
            <View style={e.indicadorTesis}>
              <Text style={[texto.etiqueta, e.rotuloTesis]}>1 · PRECISIÓN DEL MODELO</Text>
              {precision && precision.precision_pct != null ? (
                <View style={e.cifrasEnLinea}>
                  <Cifra valor={`${precision.precision_pct}%`} etiqueta="Precisión" />
                  <Cifra valor={`${precision.recall_pct}%`} etiqueta="Recall" />
                  <Cifra valor={`${precision.f1_pct}%`} etiqueta="F1" />
                </View>
              ) : (
                <Parrafo suave>
                  Sin datos: requiere que el modelo de ML esté operando junto al método por
                  umbral. Se reporta con recall y F1 porque la precisión sola es manipulable
                  —un modelo que casi nunca detecta puede alcanzar 100% y no servir de nada.
                </Parrafo>
              )}
            </View>

            <View style={e.indicadorTesis}>
              <Text style={[texto.etiqueta, e.rotuloTesis]}>2 · VOLUMEN EVALUADO</Text>
              <View style={e.cifrasEnLinea}>
                <Cifra valor={resumen.activos} etiqueta="En seguimiento activo" />
                <Cifra valor={resumen.inscritos} etiqueta="Inscritos en total" />
              </View>
            </View>

            <View style={[e.indicadorTesis, e.indicadorTesisUltimo]}>
              <Text style={[texto.etiqueta, e.rotuloTesis]}>3 · TIEMPO DE DETECCIÓN</Text>
              <View style={e.cifrasEnLinea}>
                <Cifra
                  valor={
                    resumen.dias_deteccion_promedio != null
                      ? `${resumen.dias_deteccion_promedio} d`
                      : '—'
                  }
                  etiqueta="Promedio hasta la detección"
                />
                <Cifra valor={detectados} etiqueta="Detectados" />
                <Cifra valor={censurados} etiqueta="Censurados" />
              </View>
              <Apoyo>
                Los censurados no son negativos: terminaron el seguimiento sin detección y
                podrían haberse detectado después.
              </Apoyo>
            </View>
          </View>
        </Bloque>

        {/* Detecciones ------------------------------------------------- */}
        <Bloque
          titulo="Detecciones y estado de derivación"
          descripcion="Lo que se vigila aquí es que el circuito funcione: detectada una persona, ¿se le asignó psicólogo y se cerró el caso?"
        >
          <Tabla
            filas={detecciones}
            clave={(x) => x.participante_id}
            vacio="Todavía no hay detecciones."
            columnas={[
              { titulo: 'Código', ancho: 90, celda: (x) => <Celda fuerte>{x.codigo_anonimo}</Celda> },
              { titulo: 'Empresa', flex: 1, celda: (x) => <Celda>{x.organizacion}</Celda> },
              {
                titulo: 'Agotamiento', ancho: 115,
                celda: (x) => <Celda fuerte tono={color.peligro}>{fmt(x.agotamiento)}</Celda>,
              },
              {
                titulo: 'Desvinculación', ancho: 130,
                celda: (x) => <Celda fuerte tono={color.peligro}>{fmt(x.desvinculacion)}</Celda>,
              },
              {
                titulo: 'Derivación', ancho: 190,
                celda: (x) =>
                  !x.derivacion_id ? <Insignia tono="alerta">Pendiente de asignación</Insignia>
                  : x.cerrada_en ? <Insignia tono="exito">Cerrada</Insignia>
                  : <Insignia tono="primario">{`Con ${x.psicologo ?? 'psicólogo'}`}</Insignia>,
              },
            ]}
          />
          <View style={e.pieTabla}>
            <Apoyo>
              Los puntajes van de 1 a 4 y son la última medición OLBI de cada persona. El
              motivo clínico no aparece: es del psicólogo, no del panel.
            </Apoyo>
            <Boton variante="secundario" pequeno
              onPress={() => router.push('/investigador/derivaciones')}>
              Ver todas las derivaciones
            </Boton>
          </View>
        </Bloque>

        <Exportacion />
      </Pantalla>
    </Panel>
  )
}

function fmt(valor: number | null) {
  return valor == null ? '—' : Number(valor).toFixed(2)
}

/** RF-006-10 — el dataset sale del sistema anonimizado y en un formato que
 *  otro software pueda leer, no como una captura de pantalla. */
function Exportacion() {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<string | null>(null)

  async function descargar() {
    setOcupado(true); setError(null); setListo(null)
    try {
      const r = await descargarDataset()
      setListo(`${r.nombre} · ${r.filas} respuestas`)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo generar la exportación.')
    } finally { setOcupado(false) }
  }

  return (
    <Bloque
      titulo="Exportación del dataset"
      descripcion="Respuestas, ítems y eventos en JSON, identificados solo por código anónimo. Es el archivo que se analiza fuera del sistema y el que acompaña al comité de ética."
    >
      <View style={e.exportar}>
        <Boton onPress={descargar} cargando={ocupado}>
          Descargar dataset anonimizado
        </Boton>
        {error && <Aviso>{error}</Aviso>}
        {listo && <Aviso tono="exito">Descargado: {listo}</Aviso>}
        <Apoyo>
          El archivo no contiene nombres ni correos: esos viven en la tabla de identidades,
          que ninguna consulta del panel alcanza.
        </Apoyo>
      </View>
    </Bloque>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.sm },

  // Rejillas: flexWrap en lugar de CSS grid. Cada hijo lleva su propio
  // flexBasis/minWidth y decide solo cuándo bajar de fila.
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.base },
  rejillaDoble: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.lg },

  barras: { gap: espacio.base },

  indicadores: { gap: espacio.lg },
  indicadorTesis: {
    gap: espacio.md, paddingBottom: espacio.lg,
    borderBottomWidth: 1, borderBottomColor: color.borde,
  },
  indicadorTesisUltimo: { borderBottomWidth: 0, paddingBottom: 0 },
  rotuloTesis: { color: color.textoSuave },
  cifrasEnLinea: { flexDirection: 'row', gap: espacio.xl, flexWrap: 'wrap' },

  pieTabla: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: espacio.base, flexWrap: 'wrap', paddingTop: espacio.base,
  },

  exportar: { gap: espacio.md, alignItems: 'flex-start' },
})
