/** Filtro global del investigador — implementa ESP-009 RF-009-06.
 *
 *  La empresa vive en la URL (`?empresa=`): cualquier pantalla la lee con
 *  `useFiltro()` y el sidebar la edita. Cambiar de pantalla conserva el
 *  parámetro (`conFiltro`).
 *
 *  Hubo también un rango de semanas (`?desde=&hasta=`). Se retiró porque no
 *  filtraba ninguna consulta: solo se imprimía como rótulo, y el manifiesto
 *  de exportación lo anotaba como si se hubiera aplicado. Volver a tenerlo
 *  exige decidir antes si «semana 3» es una semana del calendario o la
 *  tercera de cada participante, que empiezan en fechas distintas.
 *
 *  No hay contexto de React de por medio: la fuente de verdad es la URL, así
 *  una pantalla puede leer el filtro antes de montar el panel. */

import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { router, useFocusEffect, useGlobalSearchParams } from 'expo-router'
import { FILTRO_POR_DEFECTO, type FiltroGlobal } from './panel'

export function useFiltro(): { filtro: FiltroGlobal; fijar: (f: Partial<FiltroGlobal>) => void } {
  const params = useGlobalSearchParams<{ empresa?: string }>()
  const filtro = useMemo<FiltroGlobal>(() => ({
    organizacion_id: params.empresa && params.empresa !== 'todas' ? String(params.empresa) : null,
  }), [params.empresa])

  const fijar = useCallback((f: Partial<FiltroGlobal>) => {
    const nuevo = { ...filtro, ...f }
    router.setParams({ empresa: nuevo.organizacion_id ?? 'todas' })
  }, [filtro])

  return { filtro, fijar }
}

/** Se conserva por compatibilidad: el filtro ya no necesita proveedor. */
export function ProveedorFiltro({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** Conserva el filtro al navegar a otra pantalla del panel. */
export function conFiltro(ruta: string, filtro: FiltroGlobal): string {
  const q = new URLSearchParams({ empresa: filtro.organizacion_id ?? 'todas' })
  return `${ruta}?${q.toString()}`
}

/** Carga los datos de una pantalla del panel y los vuelve a cargar cuando
 *  cambia el filtro.
 *
 *  Hace dos cosas que a mano se olvidan. `limpiar` corre antes de pedir nada,
 *  así la pantalla vuelve a su estado de carga en vez de seguir enseñando las
 *  cifras de la empresa anterior como si fueran de la nueva. Y `vigente()`
 *  dice si esta carga sigue siendo la última: dos cambios seguidos pueden
 *  llegar desordenados —una consulta lenta de la empresa que ya se dejó atrás
 *  responde después de la nueva— y sin la guarda ganaría la respuesta vieja. */
export function useDatosDelFiltro(
  limpiar: () => void,
  cargar: (vigente: () => boolean) => Promise<void>,
  deps: unknown[],
) {
  const turno = useRef(0)
  // Las dependencias son las que pasa cada pantalla; el resto es estable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const correr = useCallback(() => {
    const mio = ++turno.current
    limpiar()
    return cargar(() => turno.current === mio)
  }, deps)
  useFocusEffect(useCallback(() => { void correr() }, [correr]))
  return correr
}
