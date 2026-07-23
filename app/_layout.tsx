import { useEffect } from 'react'
import { Appearance } from 'react-native'
import { DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { theme } from '@/constants/theme'

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
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
      </ThemeProvider>
      <StatusBar style="dark" />
    </AppProviders>
  )
}
