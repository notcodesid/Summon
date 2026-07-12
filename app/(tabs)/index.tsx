import { useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo'
import { ScreenShell } from '@/components/summon/screen-shell'
import { WalletPill } from '@/components/summon/wallet-pill'
import { AppIcon } from '@/components/summon/app-icon'
import { CollectibleMark } from '@/components/summon/collectible-mark'
import { RevealModal } from '@/components/summon/reveal-modal'
import { LoadingState } from '@/components/summon/loading-state'
import { theme } from '@/constants/theme'
import { collectibles } from '@/features/summon/mock-summon-repository'
import { useSummon } from '@/features/summon/summon-provider'
import { PullRecord } from '@/features/summon/types'

export default function SummonScreen() {
  const { isReady, user } = usePrivy()
  const solana = useEmbeddedSolanaWallet()
  const address = solana.wallets?.[0]?.address
  const { summon, summoning, pulls, loading, source, pending, error } = useSummon()
  const [result, setResult] = useState<PullRecord | null>(null)
  const [gateMessage, setGateMessage] = useState<string | null>(null)
  const item = result ? collectibles.find((x) => x.id === result.collectibleId) : null
  const latest = pulls[0] ? collectibles.find((x) => x.id === pulls[0].collectibleId) : null
  const canSummon = Boolean(isReady && user && address)

  async function onSummon() {
    setGateMessage(null)
    if (!isReady) return
    if (!user) {
      setGateMessage('Sign in to summon relics.')
      router.replace('/onboarding')
      return
    }
    if (!address) {
      setGateMessage('Your Solana wallet is still being created. Try again in a moment.')
      router.push('/account')
      return
    }
    try {
      setResult(await summon())
    } catch {
      // The provider exposes the actionable error below the button.
    }
  }

  if (loading) {
    return (
      <ScreenShell
        title={
          <Image
            source={require('@/assets/images/logo-mark.png')}
            style={styles.logo}
            tintColor="#000000"
          />
        }
        action={<WalletPill />}
      >
        <LoadingState label="Preparing your collection…" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell
      title={
        <Image
          source={require('@/assets/images/logo-mark.png')}
          style={styles.logo}
          tintColor="#000000"
        />
      }
      action={<WalletPill />}
    >
      <View style={styles.hero}>
        <View style={styles.outerOrbit}>
          <View style={styles.orbit}>
            <View style={styles.core}>
              <Image
                source={require('@/assets/images/logo-mark.png')}
                style={styles.coreLogo}
              />
            </View>
          </View>
        </View>
        <Text style={styles.heroTitle}>Something lovely{`\n`}is waiting.</Text>
        <Text style={styles.heroCopy}>Every summon is verifiably random and becomes part of your collection.</Text>

        <Pressable
          disabled={summoning || pending || !isReady}
          accessibilityRole="button"
          onPress={onSummon}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            (summoning || pending || !isReady) && styles.disabled,
            !canSummon && styles.buttonMuted,
          ]}
        >
          {summoning || pending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>{canSummon ? 'Summon now' : 'Sign in to summon'}</Text>
              <Text style={styles.buttonMeta}>{canSummon ? '1 pull' : 'Wallet'}</Text>
            </>
          )}
        </Pressable>

        {gateMessage ? <Text style={styles.gate}>{gateMessage}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.odds}>Common 60% · Rare 30% · Epic 9% · Legendary 1%</Text>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Latest discovery</Text>
        <Text style={styles.sectionMeta}>{pulls.length} pulls</Text>
      </View>

      {latest && pulls[0] ? (
        <Pressable
          style={styles.latest}
          onPress={() => router.push(`/collectible/${latest.id}`)}
          accessibilityRole="button"
        >
          <CollectibleMark mark={latest.symbol} accent={latest.accent} size={54} />
          <View style={{ flex: 1 }}>
            <Text style={styles.latestName}>{latest.name}</Text>
            <Text style={styles.latestRarity}>
              {latest.rarity} · {pulls[0].status === 'verified' ? 'Verified' : 'Demo'}
            </Text>
          </View>
          <AppIcon name="chevron.right" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : (
        <View style={styles.latest}>
          <Text style={styles.heroCopy}>Your first discovery will appear here.</Text>
        </View>
      )}

      <RevealModal visible={!!result} item={item} pull={result} onClose={() => setResult(null)} />
      {source === 'demo' ? <Text style={styles.demo}>Demo data · not on-chain</Text> : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  logo: {
    width: 84,
    height: 84,
    resizeMode: 'contain',
    marginLeft: -20,
    marginTop: -16,
    marginBottom: -16,
    tintColor: '#000000',
  },
  hero: { alignItems: 'center', paddingVertical: 18 },
  outerOrbit: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  orbit: {
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
  },
  coreLogo: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
    tintColor: '#000000',
  },
  heroTitle: {
    color: theme.colors.text,
    textAlign: 'center',
    fontFamily: theme.font.display,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1,
  },
  heroCopy: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontFamily: theme.font.body,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 310,
    marginTop: 12,
  },
  button: {
    marginTop: 28,
    width: '100%',
    minHeight: 60,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonMuted: { backgroundColor: '#2A2A28' },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: theme.font.body,
    fontSize: 17,
    fontWeight: '800',
  },
  buttonMeta: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', opacity: 0.65 },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.7 },
  gate: { color: theme.colors.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' },
  error: { color: '#9F2D24', fontSize: 12, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  odds: { color: theme.colors.textMuted, fontSize: 11, marginTop: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 19,
    fontWeight: '800',
  },
  sectionMeta: { color: theme.colors.textMuted, fontSize: 13 },
  latest: {
    minHeight: 88,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  latestName: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  latestRarity: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  demo: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center' },
})
