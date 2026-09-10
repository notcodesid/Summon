import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { MicroLabel, PrimaryButton } from '@/components/ui'
import { theme } from '@/constants/theme'
import { cannedOpponentFor } from '@/lib/canned-opponent'
import type { Creature } from '@/lib/creatures'
import {
  runEphemeralBattle,
  type BattleTurnLog,
  type BattleWinner,
  type OnchainBattle,
} from '@/lib/onchain-battle'
import type { SignAndSendProvider } from '@/lib/onchain-player'
import { takePendingBattle } from '@/lib/pending-battle'
import { usePlayer } from '@/lib/use-player'

type Phase =
  | { status: 'boot' }
  | { status: 'ready'; creature: Creature }
  | { status: 'prepare'; creature: Creature; label: string }
  | { status: 'fight'; creature: Creature; battle: OnchainBattle | null; label: string }
  | {
      status: 'result'
      creature: Creature
      winner: BattleWinner
      battle: OnchainBattle
      turns: BattleTurnLog[]
      progressionVerified: boolean
      experience: number | null
    }
  | { status: 'error'; creature: Creature | null; message: string }

function hpLabel(current: number, max: number): string {
  return `${Math.max(0, current)} / ${max}`
}

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  return (
    <View style={styles.hpTrack}>
      <View style={[styles.hpFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
    </View>
  )
}

export default function BattleScreen() {
  const [phase, setPhase] = useState<Phase>({ status: 'boot' })
  const { walletAddress } = usePlayer()
  const solana = useEmbeddedSolanaWallet()
  const embeddedWallet = 'wallets' in solana ? (solana.wallets ?? [])[0] : undefined

  useEffect(() => {
    const creature = takePendingBattle()
    if (!creature) {
      setPhase({ status: 'error', creature: null, message: 'Pick a companion from the sanctuary first.' })
      return
    }
    setPhase({ status: 'ready', creature })
  }, [])

  const onFight = useCallback(async () => {
    const creature = phase.status === 'ready' || phase.status === 'error' ? phase.creature : null
    if (!creature) return
    if (!walletAddress || !embeddedWallet) {
      setPhase({
        status: 'error',
        creature,
        message: 'Wallet is still opening. Wait a second and try again.',
      })
      return
    }

    const wallet = embeddedWallet
    setPhase({ status: 'prepare', creature, label: 'opening the match on Solana…' })
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const result = await runEphemeralBattle({
      walletAddress,
      creature,
      getProvider: () => wallet.getProvider() as Promise<SignAndSendProvider>,
      onPhase: (next, battle) => {
        if (next === 'delegate') {
          setPhase({ status: 'prepare', creature, label: 'delegating to ephemeral rollup…' })
        } else if (next === 'fight') {
          setPhase({
            status: 'fight',
            creature,
            battle: battle ?? null,
            label: battle ? `turn ${battle.turn} on the rollup` : 'fighting on the rollup…',
          })
        } else if (next === 'settle') {
          setPhase({
            status: 'fight',
            creature,
            battle: battle ?? null,
            label: 'committing result back to Solana…',
          })
        }
      },
    })

    if (!result.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setPhase({ status: 'error', creature, message: result.message })
      return
    }

    void Haptics.notificationAsync(
      result.result.winner === 'player'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    )
    setPhase({
      status: 'result',
      creature,
      winner: result.result.winner,
      battle: result.result.finalBattle,
      turns: result.result.turns,
      progressionVerified: result.result.progressionVerified,
      experience: result.result.progression?.experience ?? null,
    })
  }, [embeddedWallet, phase, walletAddress])

  const creature =
    phase.status === 'boot' || (phase.status === 'error' && !phase.creature) ? null : phase.creature
  const opponent = creature ? cannedOpponentFor(creature) : null
  const live = phase.status === 'fight' ? phase.battle : phase.status === 'result' ? phase.battle : null

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <MicroLabel>ephemeral rollup</MicroLabel>
        <View style={{ width: 22 }} />
      </View>

      {phase.status === 'boot' ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.title}>
            {phase.status === 'result'
              ? phase.winner === 'player'
                ? 'you won'
                : phase.winner === 'opponent'
                  ? 'you lost'
                  : 'draw'
              : 'wild match'}
          </Text>
          <Text style={styles.subtitle}>
            {phase.status === 'prepare' || phase.status === 'fight'
              ? phase.label
              : phase.status === 'error'
                ? phase.message
                : phase.status === 'result'
                  ? phase.progressionVerified
                    ? `${phase.winner === 'player' ? '+100' : '+25'} xp verified on Solana${phase.experience === null ? '' : ` · ${phase.experience} total`}`
                    : 'result committed · progression confirmation is still arriving'
                  : 'five turns. your animal vs a canned rival. turns run on MagicBlock.'}
          </Text>

          {creature && opponent ? (
            <View style={styles.fighters}>
              <View style={styles.fighter}>
                {creature.photoUri ? (
                  <Image source={{ uri: creature.cutoutUri || creature.photoUri }} style={styles.portrait} />
                ) : (
                  <View style={[styles.portrait, styles.portraitEmpty]} />
                )}
                <Text style={styles.fighterName} numberOfLines={1}>
                  {creature.commonName}
                </Text>
                <HpBar
                  current={live?.playerHp ?? creature.stats.hp}
                  max={live?.playerMaxHp ?? creature.stats.hp}
                  color={theme.colors.primary}
                />
                <Text style={styles.hpText}>
                  {hpLabel(live?.playerHp ?? creature.stats.hp, live?.playerMaxHp ?? creature.stats.hp)}
                </Text>
              </View>
              <Text style={styles.vs}>vs</Text>
              <View style={styles.fighter}>
                <View style={[styles.portrait, styles.rival]}>
                  <Ionicons name="paw" size={42} color="#D5B676" />
                </View>
                <Text style={styles.fighterName} numberOfLines={1}>
                  {opponent.name}
                </Text>
                <HpBar
                  current={live?.opponentHp ?? opponent.hp}
                  max={live?.opponentMaxHp ?? opponent.hp}
                  color="#C9A66B"
                />
                <Text style={styles.hpText}>
                  {hpLabel(live?.opponentHp ?? opponent.hp, live?.opponentMaxHp ?? opponent.hp)}
                </Text>
              </View>
            </View>
          ) : null}

          {phase.status === 'result' ? (
            <ScrollView style={styles.turnCard} contentContainerStyle={styles.turnCardContent}>
              <View style={styles.resultMeta}>
                <Text style={styles.resultLabel}>ONCHAIN TURN LOG</Text>
                <Text style={styles.resultValue}>{phase.turns.length} confirmed turns</Text>
              </View>
              {phase.turns.map((turn) => (
                <View key={turn.turn} style={styles.turnRow}>
                  <Text style={styles.turnName}>turn {turn.turn}</Text>
                  <Text style={styles.turnHp}>you {turn.playerHp} · rival {turn.opponentHp}</Text>
                  <Text style={styles.turnLatency}>{turn.latencyMs} ms</Text>
                </View>
              ))}
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(
                    `https://explorer.solana.com/address/${phase.battle.pda}?cluster=devnet`,
                  )
                }
                style={styles.explorerLink}
              >
                <Ionicons name="open-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.explorerText}>view battle account</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          <View style={styles.actions}>
            {phase.status === 'ready' || phase.status === 'error' ? (
              <PrimaryButton
                label={phase.status === 'error' ? 'try again' : 'fight'}
                onPress={() => void onFight()}
                disabled={!creature}
              />
            ) : phase.status === 'prepare' || phase.status === 'fight' ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <PrimaryButton label="back to sanctuary" onPress={() => router.replace('/')} />
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 16 },
  title: { ...theme.type.title, color: theme.colors.text },
  subtitle: { ...theme.type.body, color: theme.colors.textMuted, lineHeight: 22 },
  fighters: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  fighter: { flex: 1, alignItems: 'center', gap: 8 },
  portrait: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.surfaceRaised,
  },
  portraitEmpty: { borderWidth: 1, borderColor: theme.colors.border },
  rival: { backgroundColor: '#2A2418', alignItems: 'center', justifyContent: 'center' },
  fighterName: { ...theme.type.micro, color: theme.colors.text, textTransform: 'uppercase' },
  hpTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden',
  },
  hpFill: { height: '100%', borderRadius: 4 },
  hpText: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
  vs: { ...theme.type.micro, color: theme.colors.textFaint, marginBottom: 28 },
  turnCard: {
    maxHeight: 210,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  turnCardContent: { padding: 16, gap: 10 },
  resultMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { ...theme.type.micro, color: theme.colors.textFaint },
  resultValue: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  turnName: { width: 48, fontSize: 12, fontWeight: '800', color: theme.colors.text },
  turnHp: { flex: 1, fontSize: 12, color: theme.colors.textMuted },
  turnLatency: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  explorerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  explorerText: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },
  actions: { marginTop: 'auto', paddingBottom: 24, minHeight: 56, justifyContent: 'center' },
})
