import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '@/constants/theme'
import { AppConfig } from '@/constants/app-config'

/**
 * Minimal home screen — blank slate for the real-world animal collection product.
 */
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.mark}>{AppConfig.name}</Text>
        <Text style={styles.subtitle}>Explore. Scan. Collect. Battle.</Text>
        <Text style={styles.hint}>Initial app shell — product UI starts here.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  mark: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  hint: {
    marginTop: 24,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
})
