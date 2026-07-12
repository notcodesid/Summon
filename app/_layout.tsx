import { useEffect } from 'react'
import { Appearance } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { SummonProvider } from '@/features/summon/summon-provider'
import { theme } from '@/constants/theme'

export default function RootLayout() {
  useEffect(() => {
    Appearance.setColorScheme('light')
  }, [])

  return (
    <AppProviders>
      <SummonProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="account" />
          <Stack.Screen name="collectible/[id]" />
        </Stack>
      </SummonProvider>
      <StatusBar style="dark" />
    </AppProviders>
  )
}
