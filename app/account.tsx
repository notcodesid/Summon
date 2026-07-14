import { useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Clipboard from '@react-native-clipboard/clipboard'
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import { AppIcon } from '@/components/summon/app-icon'
import { theme } from '@/constants/theme'
import { AppConfig } from '@/constants/app-config'
import { useConnection } from '@/features/network/use-connection'
import { useNetwork } from '@/features/network/use-network'
import { ellipsify } from '@/utils/ellipsify'
import { emailFromPrivyUser } from '@/utils/privy-user'

/**
 * Account screen — identity, wallet, balance, network, logout.
 */
export default function AccountScreen() {
  const { isReady, user, logout } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const address = solana.wallets?.[0]?.address
  const email = emailFromPrivyUser(user)
  const connection = useConnection()
  const { selectedNetwork, networks, setSelectedNetwork } = useNetwork()

  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!address) return
    Clipboard.setString(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function openPrivacyPolicy() {
    await Linking.openURL(AppConfig.support.privacyUrl)
  }

  function requestAccountDeletion() {
    if (!AppConfig.support.email) {
      Alert.alert('Deletion contact unavailable', 'The release support email has not been configured yet.')
      return
    }

    Alert.alert(
      'Request account deletion?',
      'Deleting your login is permanent and may disconnect your embedded wallet. Public Solana transactions and player data cannot be erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            const subject = encodeURIComponent('Summon account deletion request')
            const body = encodeURIComponent(
              'Please delete my Summon account and associated off-chain user data. I understand that public blockchain data cannot be deleted.\n\nSign-in email:',
            )
            void Linking.openURL(`mailto:${AppConfig.support.email}?subject=${subject}&body=${body}`)
          },
        },
      ],
    )
  }

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

      <ScrollView contentContainerStyle={styles.body}>
        {!isReady ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : !user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Not signed in</Text>
            <Text style={styles.muted}>
              Sign up with Google. We create a Privy Solana wallet for you automatically.
            </Text>
            <Pressable style={styles.primary} onPress={() => router.replace('/onboarding')}>
              <Text style={styles.primaryText}>Sign up</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>ACCOUNT</Text>
              <Text style={styles.value}>{email ?? 'Signed in'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>SOLANA WALLET</Text>
              <View style={styles.addressRow}>
                <Text style={styles.value}>{address ? ellipsify(address, 8) : 'Creating Solana wallet…'}</Text>
                {address ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Copy wallet address"
                    onPress={handleCopy}
                    style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <AppIcon
                      name={copied ? 'checkmark' : 'doc.on.doc'}
                      size={16}
                      color={copied ? '#4D8C57' : theme.colors.textMuted}
                      weight="medium"
                    />
                  </Pressable>
                ) : null}
              </View>
              {address ? (
                <Text style={styles.muted}>
                  Balance: {balance.isLoading ? '…' : `${((balance.data ?? 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL`}
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
                    <Text style={[styles.chipText, selectedNetwork.id === n.id && styles.chipTextActive]}>
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
                router.replace('/onboarding')
              }}
            >
              <Text style={styles.dangerText}>Log out</Text>
            </Pressable>

            <View style={styles.legalRow}>
              <Pressable accessibilityRole="link" onPress={openPrivacyPolicy} hitSlop={8}>
                <Text style={styles.legalText}>Privacy policy</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable accessibilityRole="button" onPress={requestAccountDeletion} hitSlop={8}>
                <Text style={styles.legalText}>Request account deletion</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  copyButton: {
    padding: 8,
    marginRight: -8,
    borderRadius: 8,
    backgroundColor: 'transparent',
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
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  legalText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  legalDot: { color: theme.colors.textMuted, fontSize: 13 },
})
