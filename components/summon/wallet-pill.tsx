import { Pressable, StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'
import { AppIcon } from '@/components/summon/app-icon'
import { theme } from '@/constants/theme'
import { ellipsify } from '@/utils/ellipsify'
import { emailFromPrivyUser } from '@/utils/privy-user'

/**
 * Header account control — Sign in (social) or wallet address when ready.
 * Not a browser "Connect wallet" flow; Privy embeds the Solana wallet after login.
 */
export function WalletPill() {
  const { isReady, user } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const address = solana.wallets?.[0]?.address
  const email = emailFromPrivyUser(user)

  const label = !isReady
    ? '…'
    : address
      ? ellipsify(address, 4)
      : user
        ? email
          ? email.split('@')[0]
          : 'Wallet…'
        : 'Sign in'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={user ? 'Open account' : 'Sign in'}
      onPress={() => router.push(user ? '/account' : '/onboarding')}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <AppIcon
        name={user ? 'person.crop.circle' : 'person.crop.circle'}
        size={17}
        color={theme.colors.text}
        weight="medium"
      />
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    minHeight: 44,
    maxWidth: 160,
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
    flexShrink: 1,
  },
})
