/** Textos de la pantalla principal que dependen de la hora o del día.
 *
 *  Sin dependencias: se prueba con una fecha fija. */

/** Saludo y subtítulo según la hora local. La app se abre casi siempre al
 *  final de la jornada; el texto acompaña ese momento sin dar órdenes. */
export function saludoPorHora(fecha = new Date()): { titulo: string; subtitulo: string } {
  const h = fecha.getHours()
  if (h < 12) {
    return { titulo: 'Buenos días.', subtitulo: 'Un momento para empezar el día con calma.' }
  }
  if (h < 19) {
    return {
      titulo: 'Buenas tardes.',
      subtitulo: 'Tómate un respiro antes de cerrar tu jornada laboral.',
    }
  }
  return { titulo: 'Buenas noches.', subtitulo: 'Un minuto para cerrar el día antes de descansar.' }
}

/** "jueves, 24 de octubre" → la pantalla lo pone en mayúsculas. */
export function fechaLarga(fecha = new Date()): string {
  return fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Frases del día. Neutras y breves: acompañan, no aconsejan ni diagnostican.
 *  Se elige por día del año para que cambie a diario sin depender del
 *  servidor. */
const FRASES = [
  'El descanso no es una recompensa al final de la productividad; es una necesidad previa a todo lo demás.',
  'No todo lo que pesa se nota el mismo día en que se carga.',
  'Un día lento también cuenta como un día.',
  'Parar un momento no es perder el ritmo. Es escucharlo.',
  'Lo que hoy es cansancio, mañana puede ser información.',
  'Hay silencios que descansan más que cualquier respuesta.',
  'La jornada termina cuando la sueltas, no cuando la cierras.',
]

export function fraseDelDia(fecha = new Date()): string {
  const inicio = new Date(fecha.getFullYear(), 0, 0)
  const diaDelAno = Math.floor((fecha.getTime() - inicio.getTime()) / 86_400_000)
  return FRASES[diaDelAno % FRASES.length]
}
