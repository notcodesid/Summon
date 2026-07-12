import { Pressable, StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'
import { AppIcon } from '@/components/summon/app-icon'
import { theme } from '@/constants/theme'
import { ellipsify } from '@/utils/ellipsify'

/**
 * Header wallet control — navigates to login or account screens.
 */
export function WalletPill() {
  const { isReady, user } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const address = solana.wallets?.[0]?.address

  const label = !isReady
    ? '…'
    : address
      ? ellipsify(address, 4)
      : user
        ? 'Wallet…'
        : 'Connect'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open wallet"
      onPress={() => router.push(user ? '/account' : '/login')}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <AppIcon name="wallet.pass" size={17} color={theme.colors.text} weight="medium" />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
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
})
