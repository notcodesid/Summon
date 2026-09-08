import { useMemo } from 'react'
import { LogBox, useColorScheme } from 'react-native'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { theme } from '@/constants/theme'

// web3.js already retries crowded-RPC (429) answers internally with backoff.
// The retry chatter is handled: keep it out of the red box (device) and out
// of the Metro terminal (dev client forwards device console there too).
LogBox.ignoreLogs(['Server responded with 429'])

const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  if (args.some((arg) => typeof arg === 'string' && arg.includes('Server responded with 429'))) {
    return
  }
  originalConsoleError(...(args as []))
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme
  const navigationTheme = useMemo(
    () => ({
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.text,
        border: theme.colors.border,
        primary: theme.colors.text,
      },
    }),
    [baseTheme],
  )

  return (
    <AppProviders>
      <ThemeProvider value={navigationTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(app)" />
        </Stack>
      </ThemeProvider>
      <StatusBar style="auto" />
    </AppProviders>
  )
}
