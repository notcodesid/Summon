import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { theme } from '@/constants/theme'
import { AppConfig } from '@/constants/app-config'

/**
 * First screen after open — no auth yet.
 * Primary action: open the in-app camera to scan.
 */
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.mark}>{AppConfig.name}</Text>
          <Text style={styles.subtitle}>Explore. Scan. Collect. Battle.</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
          onPress={() => router.push('/camera')}
          accessibilityRole="button"
          accessibilityLabel="Open camera to scan"
        >
          <Text style={styles.scanButtonText}>scan</Text>
        </Pressable>
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
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  hero: {
    alignItems: 'center',
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
  scanButton: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
  },
  scanButtonPressed: {
    opacity: 0.88,
  },
  scanButtonText: {
    color: theme.colors.background,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
