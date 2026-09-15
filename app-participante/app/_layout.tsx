import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter'
import { Cargando } from '../modules/nucleo/ui'
import { color, fuente } from '../modules/nucleo/diseno'

export default function Layout() {
  // Un peso por archivo. Hasta que carguen, todo el sistema de tipografía
  // apuntaría a familias inexistentes y el texto saldría con la fuente del
  // sistema y otro ritmo vertical; por eso se espera.
  const [fuentesListas, errorFuentes] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  })

  // Si la carga falla se sigue igual: la app cae a la fuente del sistema y se
  // ve peor, pero se usa. Un estudio longitudinal no puede quedarse en blanco
  // porque no bajó una tipografía.
  if (!fuentesListas && !errorFuentes) return <Cargando />

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: color.fondo },
          headerTitleStyle: { fontSize: 17, fontFamily: fuente.fuerte, color: color.texto },
          headerTintColor: color.primario,
          contentStyle: { backgroundColor: color.fondo },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="acceso" options={{ title: 'Acceso' }} />

        {/* Participante */}
        <Stack.Screen name="consentimiento" options={{ title: 'Consentimiento', headerBackVisible: false }} />
        <Stack.Screen name="hoy" options={{ title: 'Estudio Burnout', headerBackVisible: false }} />
        <Stack.Screen name="formulario/[clave]" options={{ title: '' }} />
        <Stack.Screen name="consulta/[id]" options={{ title: 'Sesión de apoyo' }} />

        {/* Psicólogo */}
        <Stack.Screen name="psicologo/index" options={{ title: 'Casos', headerBackVisible: false }} />
        <Stack.Screen name="psicologo/caso/[id]" options={{ title: 'Caso' }} />
        <Stack.Screen name="psicologo/consulta/[id]" options={{ title: 'Videoconsulta' }} />
        <Stack.Screen name="psicologo/informe/[id]" options={{ title: 'Informe' }} />

        {/* Investigador — panel web con navegación propia, sin cabecera del Stack */}
        <Stack.Screen name="investigador/index" options={{ headerShown: false }} />
        <Stack.Screen name="investigador/participantes" options={{ headerShown: false }} />
        <Stack.Screen name="investigador/participante/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="investigador/derivaciones" options={{ headerShown: false }} />
        <Stack.Screen name="investigador/empresas" options={{ headerShown: false }} />
        <Stack.Screen name="investigador/empresa/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="investigador/psicologos" options={{ headerShown: false }} />
        <Stack.Screen name="investigador/auditoria" options={{ headerShown: false }} />

        {/* Administrador de empresa */}
        <Stack.Screen name="admin/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/participantes" options={{ headerShown: false }} />
      </Stack>
    </>
  )
}
