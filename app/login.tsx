import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { usePrivy } from '@privy-io/expo'
import { AppIcon } from '@/components/summon/app-icon'
import { EmailLoginForm } from '@/components/summon/email-login-form'
import { theme } from '@/constants/theme'

/**
 * Dedicated auth screen — first-class login flow (not only the header sheet).
 */
export default function LoginScreen() {
  const { isReady, user } = usePrivy()

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.text} />
        </View>
      </SafeAreaView>
    )
  }

  if (user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <AppIcon name="checkmark.circle.fill" size={40} color={theme.colors.text} />
          </View>
          <Text style={styles.title}>You&apos;re signed in</Text>
          <Text style={styles.copy}>Your Privy wallet is ready for summons.</Text>
          <Pressable
            style={styles.cta}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.back}
        >
          <AppIcon name="chevron.left" size={18} color={theme.colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Connect to summon</Text>
        <EmailLoginForm
          submitLabel="Verify & enter"
          onSuccess={() => router.replace('/(tabs)')}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  content: { flex: 1, padding: 24, gap: 16 },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 40,
  },
  eyebrow: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  copy: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  cta: {
    marginTop: 12,
    minHeight: 54,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
