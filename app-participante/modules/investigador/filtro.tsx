/** Filtro global del investigador — implementa ESP-009 RF-009-06.
 *
 *  Empresa y rango de semanas viven en la URL (`?empresa=&desde=&hasta=`):
 *  cualquier pantalla los lee con `useFiltro()` y el sidebar los edita.
 *  Cambiar de pantalla conserva los parámetros (`conFiltro`).
 *
 *  No hay contexto de React de por medio: la fuente de verdad es la URL, así
 *  una pantalla puede leer el filtro antes de montar el panel. */

import { useCallback, useMemo, type ReactNode } from 'react'
import { router, useGlobalSearchParams } from 'expo-router'
import { FILTRO_POR_DEFECTO, type FiltroGlobal } from './panel'

export function useFiltro(): { filtro: FiltroGlobal; fijar: (f: Partial<FiltroGlobal>) => void } {
  const params = useGlobalSearchParams<{ empresa?: string; desde?: string; hasta?: string }>()
  const filtro = useMemo<FiltroGlobal>(() => ({
    organizacion_id: params.empresa && params.empresa !== 'todas' ? String(params.empresa) : null,
    semanaDesde: Number(params.desde) || FILTRO_POR_DEFECTO.semanaDesde,
    semanaHasta: Number(params.hasta) || FILTRO_POR_DEFECTO.semanaHasta,
  }), [params.empresa, params.desde, params.hasta])

  const fijar = useCallback((f: Partial<FiltroGlobal>) => {
    const nuevo = { ...filtro, ...f }
    router.setParams({
      empresa: nuevo.organizacion_id ?? 'todas',
      desde: String(nuevo.semanaDesde),
      hasta: String(nuevo.semanaHasta),
    })
  }, [filtro])

  return { filtro, fijar }
}

/** Se conserva por compatibilidad: el filtro ya no necesita proveedor. */
export function ProveedorFiltro({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** Conserva el filtro al navegar a otra pantalla del panel. */
export function conFiltro(ruta: string, filtro: FiltroGlobal): string {
  const q = new URLSearchParams({
    empresa: filtro.organizacion_id ?? 'todas',
    desde: String(filtro.semanaDesde),
    hasta: String(filtro.semanaHasta),
  })
  return `${ruta}?${q.toString()}`
}
