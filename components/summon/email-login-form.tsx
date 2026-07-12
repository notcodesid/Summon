import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLoginWithEmail } from '@privy-io/expo'
import { theme } from '@/constants/theme'

export function EmailLoginForm({
  onSuccess,
  submitLabel = 'Verify & continue',
}: {
  onSuccess?: () => void
  submitLabel?: string
}) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { sendCode, loginWithCode } = useLoginWithEmail()

  async function onSendCode() {
    try {
      setBusy(true)
      setStatus(null)
      await sendCode({ email: email.trim() })
      setCodeSent(true)
      setStatus('Code sent — check your email')
    } catch (e) {
      setStatus(`Send failed: ${e}`)
    } finally {
      setBusy(false)
    }
  }

  async function onLogin() {
    try {
      setBusy(true)
      setStatus(null)
      await loginWithCode({ email: email.trim(), code: code.trim() })
      onSuccess?.()
    } catch (e) {
      setStatus(`Login failed: ${e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.copy}>
        Sign in with email. Privy creates a Solana wallet for you automatically.
      </Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={theme.colors.textMuted}
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      {codeSent ? (
        <>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            placeholder="OTP code"
            placeholderTextColor={theme.colors.textMuted}
            value={code}
            onChangeText={setCode}
            style={styles.input}
          />
          <Pressable
            disabled={busy || !code.trim()}
            onPress={onLogin}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>{submitLabel}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Pressable
          disabled={busy || !email.trim()}
          onPress={onSendCode}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Send code</Text>
          )}
        </Pressable>
      )}
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  copy: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 16,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.7 },
  status: { color: theme.colors.textMuted, fontSize: 13 },
})
