/** Pantalla de formulario — implementa ESP-002 (RF-002-03, RF-002-04).
 *
 *  Sirve a los cuatro instrumentos: la ruta recibe la clave y todo lo demás
 *  proviene de la definición almacenada en base de datos. */

import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { obtenerTrabajador } from '../../modules/acceso/datos'
import {
  calendarios, enviarRespuesta, obtenerFormulario, prediccionActual, registrarInicio, ultimaPrediccionSemana,
} from '../../modules/recoleccion/datos'
import { Formulario as FormularioUI } from '../../modules/recoleccion/componentes/Formulario'
import type { ClaveFormulario, Formulario, Valores } from '../../modules/nucleo/tipos'
import { Cargando } from '../../modules/nucleo/ui'
import {
  consejoDelDia, dejarConsejo, guardarResultado, resultadoDesde,
} from '../../modules/trabajador/resultado'

export default function PantallaFormulario() {
  const { clave, cierre: mostrarCierre } = useLocalSearchParams<{ clave: ClaveFormulario; cierre?: string }>()
  const navegacion = useNavigation()

  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [trabajadorId, setTrabajadorId] = useState<string | null>(null)
  const [iniciadoEn, setIniciadoEn] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // RN-002-03 — `iniciado_en` se captura al MONTAR, no al enviar. Es la mitad
  // del indicador de tiempo de detección de la tesis.
  useEffect(() => {
    let vigente = true

    async function preparar() {
      const trabajador = await obtenerTrabajador()
      if (!trabajador || !vigente) return

      const def = await obtenerFormulario(clave)
      if (!vigente) return

      const marca = await registrarInicio(trabajador.id, clave)
      if (!vigente) return

      setTrabajadorId(trabajador.id)
      setFormulario(def)
      setIniciadoEn(marca)
      navegacion.setOptions({ title: def.definicion.titulo })
    }

    preparar().catch(() => {
      Alert.alert('No se pudo cargar', 'Revisa tu conexión e inténtalo de nuevo.')
      router.back()
    })

    return () => {
      vigente = false
    }
  }, [clave, navegacion])

  async function enviar(valores: Valores) {
    if (!formulario || !trabajadorId || !iniciadoEn) return

    setEnviando(true)
    try {
      const { evaluacion } = await enviarRespuesta({ trabajadorId, formulario, iniciadoEn, valores })

      // RF-002-12 — retroalimentación. El OLBI del viernes deja su resultado
      // guardado; el check-in diario deja un consejo según el día.
      let cierre = mostrarCierre
      if (evaluacion) {
        // RF-002-14 — la retrospectiva se lee ANTES de pedir el pronóstico,
        // para que la última predicción de la semana siga siendo la del
        // nowcast y no la que se acaba de registrar.
        const [retrospectiva, pronostico] = await Promise.all([
          ultimaPrediccionSemana(trabajadorId),
          prediccionActual(trabajadorId, 'pronostico'),
        ])
        await guardarResultado({ ...resultadoDesde(evaluacion), retrospectiva, pronostico })
        cierre = 'resultado'
      } else if (clave === 'diario') {
        dejarConsejo(consejoDelDia(valores))
        cierre = 'cierre'
      }

      // RF-002-11 — si otro formulario va «después de» este (el viernes, las
      // tres preguntas de la semana tras el OLBI), se encadena sin volver a
      // la pantalla principal: para la persona es una sola sesión. El cierre
      // se muestra al final de la cadena.
      const siguiente = await siguienteEncadenado(clave)
      if (siguiente) router.replace({ pathname: `/formulario/${siguiente}`, params: { cierre } })
      else if (cierre) router.replace({ pathname: '/hoy', params: { mostrar: cierre } })
      else if (router.canGoBack()) router.back()
      else router.replace('/')
    } catch {
      Alert.alert(
        'No se pudo enviar',
        'Tus respuestas no se han perdido. Revisa tu conexión e inténtalo de nuevo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  if (!formulario) return <Cargando />

  return (
    <FormularioUI
      definicion={formulario.definicion}
      enviando={enviando}
      onEnviar={enviar}
    />
  )
}

/** Qué formulario se abre solo al terminar este.
 *
 *  El `semanal` sí: son tres preguntas pegadas al cuestionario, y para la
 *  persona es una sola sesión.
 *
 *  El `olbi` NO, aunque también declare `despues_de: diario`. Encadenar
 *  cuatro minutos justo después de prometer quince segundos es como se pierde
 *  a la gente: el cierre lo ofrece con un botón, y si no es el momento la
 *  tarjeta se queda esperando en el inicio. `despues_de` sigue sirviendo para
 *  lo otro que hace: que no aparezca antes de responder el check-in del día. */
const NO_SE_ENCADENAN: ClaveFormulario[] = ['olbi']

async function siguienteEncadenado(clave: ClaveFormulario): Promise<ClaveFormulario | null> {
  try {
    const todos = await calendarios()
    const encontrado = (Object.keys(todos) as ClaveFormulario[]).find(
      (k) => todos[k]?.despues_de === clave && !NO_SE_ENCADENAN.includes(k),
    )
    return encontrado ?? null
  } catch {
    return null
  }
}
