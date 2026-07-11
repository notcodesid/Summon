import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useEmbeddedSolanaWallet, useLoginWithEmail, usePrivy } from '@privy-io/expo'
import { AppIcon } from '@/components/summon/app-icon'
import { theme } from '@/constants/theme'
import { ellipsify } from '@/utils/ellipsify'

/**
 * Header wallet control.
 * Privy is configured in AppProviders; this pill was previously a static
 * placeholder that always said "Connect". It now drives email login and
 * shows the embedded Solana address when ready.
 */
export function WalletPill() {
  const { isReady, user, logout } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const address = solana.wallets?.[0]?.address
  const [open, setOpen] = useState(false)

  const label = !isReady
    ? '…'
    : address
      ? ellipsify(address, 4)
      : user
        ? 'Wallet…'
        : 'Connect'

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open wallet"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.root, pressed && styles.pressed]}
      >
        <AppIcon name="wallet.pass" size={17} color={theme.colors.text} weight="medium" />
        <Text style={styles.text}>{label}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Wallet</Text>
          {!isReady ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : user ? (
            <LoggedInSheet
              address={address}
              onCreateWallet={async () => {
                if (solana.create) await solana.create()
              }}
              canCreate={Boolean(solana.create) && !address}
              onLogout={async () => {
                await logout()
                setOpen(false)
              }}
              onClose={() => setOpen(false)}
            />
          ) : (
            <LoginSheet onDone={() => setOpen(false)} />
          )}
        </View>
      </Modal>
    </>
  )
}

function LoginSheet({ onDone }: { onDone: () => void }) {
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
      // Wallet may auto-create via createOnLogin
      onDone()
    } catch (e) {
      setStatus(`Login failed: ${e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.copy}>Sign in with email. Privy creates a Solana wallet for you.</Text>
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
              <Text style={styles.primaryBtnText}>Verify & log in</Text>
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

function LoggedInSheet({
  address,
  canCreate,
  onCreateWallet,
  onLogout,
  onClose,
}: {
  address?: string
  canCreate: boolean
  onCreateWallet: () => Promise<void>
  onLogout: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  return (
    <View style={styles.stack}>
      {address ? (
        <>
          <Text style={styles.copy}>Privy Solana wallet</Text>
          <Text style={styles.address}>{address}</Text>
        </>
      ) : (
        <>
          <Text style={styles.copy}>Logged in — creating / missing Solana wallet</Text>
          {canCreate ? (
            <Pressable
              disabled={busy}
              onPress={async () => {
                try {
                  setBusy(true)
                  setStatus(null)
                  await onCreateWallet()
                  setStatus('Wallet created')
                } catch (e) {
                  setStatus(`Create failed: ${e}`)
                } finally {
                  setBusy(false)
                }
              }}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Create Solana wallet</Text>
            </Pressable>
          ) : null}
        </>
      )}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
        <Text style={styles.secondaryBtnText}>Done</Text>
      </Pressable>
      <Pressable onPress={onLogout} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
        <Text style={styles.secondaryBtnText}>Log out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    minHeight: 44,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.65 },
  text: {
    color: theme.colors.text,
    fontFamily: theme.font.body,
    fontSize: 13,
    fontWeight: '700',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    marginTop: 'auto',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 24,
    fontWeight: '800',
  },
  stack: { gap: 12 },
  copy: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  address: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: theme.font.body,
  },
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
  secondaryBtn: {
    minHeight: 48,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.7 },
  status: { color: theme.colors.textMuted, fontSize: 13 },
})
