import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { GlassTabBar } from '@/components/glass-tab-bar'
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

/**
 * Home and Profile are tabs. Camera and reveal are reachable by
 * navigation but never appear in the bar — `href: null` keeps them routable.
 */
function AppStack() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

      <Tabs.Screen
        name="camera"
        options={{
          href: null,
          sceneStyle: { backgroundColor: theme.colors.viewfinder },
        }}
      />
      <Tabs.Screen name="reveal" options={{ href: null }} />
      <Tabs.Screen name="collection" options={{ href: null }} />
    </Tabs>
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
