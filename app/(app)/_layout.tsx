import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Redirect, Stack } from 'expo-router'
import { AuthBoundary } from '@privy-io/expo'
import { theme } from '@/constants/theme'
import { isAuthBypassed, isPrivyConfigured } from '@/lib/privy-config'

function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  )
}

function ErrorScreen({ error }: { error: Error }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorTitle}>something went wrong</Text>
      <Text style={styles.errorBody}>{error.message}</Text>
    </View>
  )
}

/** Tabs use the native system bar; camera and reveal remain full-screen routes. */
function AppStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="camera" options={{ contentStyle: { backgroundColor: theme.colors.viewfinder } }} />
      <Stack.Screen name="reveal" />
      <Stack.Screen name="battle" />
    </Stack>
  )
}

/**
 * Protected routes when auth is on. Bypass skips Privy gate entirely.
 */
export default function AppGroupLayout() {
  if (isAuthBypassed) {
    return <AppStack />
  }

  if (!isPrivyConfigured) {
    return <Redirect href="/login" />
  }

  return (
    <AuthBoundary
      loading={<LoadingScreen />}
      error={(error) => <ErrorScreen error={error} />}
      unauthenticated={<Redirect href="/login" />}
    >
      <AppStack />
    </AuthBoundary>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  errorBody: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
})
