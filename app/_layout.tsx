import { useEffect } from 'react'
import { Appearance } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { SummonProvider } from '@/features/summon/summon-provider'

export default function RootLayout() {
  useEffect(() => {
    // Summon is light-only; prevent system dark mode from tinting native chrome.
    Appearance.setColorScheme('light')
  }, [])

  return (
    <AppProviders>
      <SummonProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FCFCFB' } }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SummonProvider>
      <StatusBar style="dark" />
    </AppProviders>
  )
}
