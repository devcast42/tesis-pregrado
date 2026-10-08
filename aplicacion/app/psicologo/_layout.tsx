/** El psicólogo tiene su propia pila, como el trabajador.
 *
 *  Dentro van las tres pestañas, y encima de ellas lo que se abre desde una
 *  tarjeta: la ficha del caso, la nota clínica, la historia de la persona y
 *  la videollamada. Esas cuatro no son pestañas —no se va a ellas, se
 *  vuelve— así que conservan la cabecera con su título y su flecha.
 *
 *  Los títulos y los colores se heredan del Stack de la raíz; aquí solo se
 *  dice cuál es cuál. */

import { Stack } from 'expo-router'
import { color, fuente } from '../../modules/nucleo/diseno'

export default function PilaPsicologo() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: color.fondo },
        headerTitleStyle: { fontSize: 17, fontFamily: fuente.fuerte, color: color.texto },
        headerTintColor: color.primario,
        contentStyle: { backgroundColor: color.fondo },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="caso/[id]" options={{ title: 'Detalle de caso' }} />
      <Stack.Screen name="consulta/[id]" options={{ title: 'Videoconsulta' }} />
      <Stack.Screen name="informe/[id]" options={{ title: 'Nota clínica' }} />
      <Stack.Screen name="persona/[id]" options={{ title: 'Historia de la persona' }} />
    </Stack>
  )
}
