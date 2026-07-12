import { useEffect } from 'react'
import { Appearance } from 'react-native'
import { DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { SummonProvider } from '@/features/summon/summon-provider'
import { theme } from '@/constants/theme'

/** Matches app light canvas so Liquid Glass tab chrome composites cleanly. */
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: theme.colors.background,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.text,
  },
}

export default function RootLayout() {
  useEffect(() => {
    Appearance.setColorScheme('light')
  }, [])

  return (
    <AppProviders>
      <ThemeProvider value={navigationTheme}>
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
      </ThemeProvider>
      <StatusBar style="dark" />
    </AppProviders>
  )
}
