import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useOnboarding } from '@/features/onboarding/use-onboarding'
import { theme } from '@/constants/theme'

/**
 * Entry gate: first-time users → onboarding, everyone else → main tabs.
 */
export default function Index() {
  const { ready, completed } = useOnboarding()

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.text} />
      </View>
    )
  }

  if (!completed) {
    return <Redirect href="/onboarding" />
  }

  return <Redirect href="/(tabs)" />
}
