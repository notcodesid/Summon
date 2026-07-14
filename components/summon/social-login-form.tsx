import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLoginWithOAuth } from '@privy-io/expo'
import { theme } from '@/constants/theme'

/**
 * Apple and Google signup via Privy OAuth.
 * On success Privy creates an embedded Solana wallet (see AppProviders createOnLogin).
 *
 * Dashboard: enable Apple and Google under Login methods → Socials.
 */
export function SocialLoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { login } = useLoginWithOAuth()
  const [busyProvider, setBusyProvider] = useState<'apple' | 'google' | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function onSocialSignIn(provider: 'apple' | 'google') {
    try {
      setBusyProvider(provider)
      setStatus(null)
      await login({ provider })
      onSuccess?.()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // User cancelled the sheet — don't treat as a hard error.
      if (/cancel|dismiss|abort/i.test(message)) {
        setStatus(null)
      } else {
        setStatus(`Sign-in failed: ${message}`)
      }
    } finally {
      setBusyProvider(null)
    }
  }

  const busy = busyProvider !== null

  return (
    <View style={styles.stack}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Apple"
        disabled={busy}
        onPress={() => void onSocialSignIn('apple')}
        style={({ pressed }) => [styles.btn, styles.apple, pressed && styles.pressed, busy && styles.disabled]}
      >
        {busyProvider === 'apple' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.appleText}>Continue with Apple</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        disabled={busy}
        onPress={() => void onSocialSignIn('google')}
        style={({ pressed }) => [styles.btn, styles.google, pressed && styles.pressed, busy && styles.disabled]}
      >
        {busyProvider === 'google' ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={styles.googleText}>Continue with Google</Text>
        )}
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  btn: {
    minHeight: 52,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  google: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  apple: { backgroundColor: '#000000' },
  appleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  googleText: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.65 },
  status: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
})
