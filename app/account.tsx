import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import { AppIcon } from '@/components/summon/app-icon'
import { theme } from '@/constants/theme'
import { useConnection } from '@/features/network/use-connection'
import { useNetwork } from '@/features/network/use-network'
import { ellipsify } from '@/utils/ellipsify'

/**
 * Account screen — wallet, balance, network, logout.
 */
export default function AccountScreen() {
  const { isReady, user, logout } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const address = solana.wallets?.[0]?.address
  const connection = useConnection()
  const { selectedNetwork, networks, setSelectedNetwork } = useNetwork()

  const balance = useQuery({
    queryKey: ['account-balance', selectedNetwork.id, address],
    enabled: Boolean(address),
    queryFn: () => connection.getBalance(new PublicKey(address!)),
  })

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.back}>
          <AppIcon name="chevron.left" size={18} color={theme.colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Account</Text>
      </View>

      <View style={styles.body}>
        {!isReady ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : !user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Not signed in</Text>
            <Text style={styles.muted}>Connect with Privy to summon and track ownership.</Text>
            <Pressable style={styles.primary} onPress={() => router.push('/login')}>
              <Text style={styles.primaryText}>Sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>WALLET</Text>
              <Text style={styles.value}>
                {address ? ellipsify(address, 8) : 'Creating Solana wallet…'}
              </Text>
              {address ? (
                <Text style={styles.muted}>
                  Balance:{' '}
                  {balance.isLoading
                    ? '…'
                    : `${((balance.data ?? 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL`}
                </Text>
              ) : solana.create ? (
                <Pressable
                  style={styles.secondary}
                  onPress={async () => {
                    await solana.create?.()
                  }}
                >
                  <Text style={styles.secondaryText}>Create Solana wallet</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>NETWORK</Text>
              <Text style={styles.value}>{selectedNetwork.label}</Text>
              <View style={styles.row}>
                {networks.map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => setSelectedNetwork(n)}
                    style={[styles.chip, selectedNetwork.id === n.id && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, selectedNetwork.id === n.id && styles.chipTextActive]}
                    >
                      {n.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={styles.danger}
              onPress={async () => {
                await logout()
                router.replace('/(tabs)')
              }}
            >
              <Text style={styles.dangerText}>Log out</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 32,
    fontWeight: '800',
  },
  body: { padding: 20, gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.card,
    padding: 18,
    gap: 8,
    boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  value: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: theme.colors.text },
  chipText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  primary: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: {
    marginTop: 6,
    minHeight: 44,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: theme.colors.text, fontWeight: '700' },
  danger: {
    minHeight: 50,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: theme.colors.text, fontWeight: '800' },
})
