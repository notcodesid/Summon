import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '@/constants/theme'
import { playSound } from '@/lib/audio'
import { cannedOpponentFor, matchupAgainst, type Matchup } from '@/lib/canned-opponent'
import {
  actionDescription,
  ecologicalClassFor,
  instinctNameFor,
  passiveTraitIndex,
  type BattleAction,
} from '@/lib/battle-rules'
import {
  CLASS_INDEX,
  INSTINCT_COST,
  MAX_ENERGY,
  canUseInstinct,
  guardIncomingPercent,
  previewTurn,
  type CombatInput,
  type TurnPreview,
} from '@/lib/combat'
import type { Creature } from '@/lib/creatures'
import { battleActionFeedback, battleResultFeedback } from '@/lib/feedback-cues'
import {
  playInteractiveTurn,
  prepareInteractiveBattle,
  settleInteractiveBattle,
  type ErBattleResult,
  type InteractiveBattleSession,
} from '@/lib/onchain-battle'
import type { SignAndSendProvider } from '@/lib/onchain-player'
import { takePendingBattle } from '@/lib/pending-battle'
import { usePlayer } from '@/lib/use-player'

type Phase = 'boot' | 'ready' | 'preparing' | 'active' | 'resolving' | 'settling' | 'result' | 'error'

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const scale = useRef(new Animated.Value(max ? current / max : 0)).current
  useEffect(() => {
    Animated.timing(scale, { toValue: max ? current / max : 0, duration: 180, useNativeDriver: true }).start()
  }, [current, max, scale])
  return (
    <View style={styles.hpTrack}>
      <Animated.View style={[styles.hpFill, { backgroundColor: color, transform: [{ scaleX: scale }] }]} />
    </View>
  )
}

export default function BattleScreen() {
  const [creature, setCreature] = useState<Creature | null>(null)
  const [phase, setPhase] = useState<Phase>('boot')
  const [session, setSession] = useState<InteractiveBattleSession | null>(null)
  const [result, setResult] = useState<ErBattleResult | null>(null)
  const [message, setMessage] = useState('Choose your move')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const playerHit = useRef(new Animated.Value(0)).current
  const rivalHit = useRef(new Animated.Value(0)).current
  const impactBurst = useRef(new Animated.Value(0)).current
  const { walletAddress } = usePlayer()
  const solana = useEmbeddedSolanaWallet()
  const embeddedWallet = 'wallets' in solana ? (solana.wallets ?? [])[0] : undefined

  useEffect(() => {
    const pending = takePendingBattle()
    setCreature(pending)
    setPhase(pending ? 'ready' : 'error')
    if (!pending) setMessage('Pick a companion from the sanctuary first.')
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => subscription.remove()
  }, [])

  const reactToTurn = useCallback(
    (playerDamage: number, opponentDamage: number) => {
      if (reduceMotion) return
      const hit = (value: Animated.Value, direction: number) =>
        Animated.sequence([
          Animated.timing(value, { toValue: direction, duration: 70, useNativeDriver: true }),
          Animated.spring(value, { toValue: 0, damping: 16, stiffness: 240, useNativeDriver: true }),
        ]).start()
      if (playerDamage > 0) hit(playerHit, -8)
      if (opponentDamage > 0) hit(rivalHit, 8)
      if (playerDamage > 0 || opponentDamage > 0) {
        impactBurst.setValue(0)
        Animated.timing(impactBurst, { toValue: 1, duration: 220, useNativeDriver: true }).start()
      }
    },
    [impactBurst, playerHit, reduceMotion, rivalHit],
  )

  const start = useCallback(async () => {
    if (!creature || !walletAddress || !embeddedWallet) {
      setMessage('Wallet is still opening. Wait a second and try again.')
      setPhase('error')
      return
    }
    setPhase('preparing')
    setMessage('Opening a fast arena…')
    try {
      const wallet = embeddedWallet
      const next = await prepareInteractiveBattle({
        walletAddress,
        creature,
        getProvider: () => wallet.getProvider() as Promise<SignAndSendProvider>,
      })
      setSession(next)
      setPhase('active')
      setMessage(next.battle.playerSpeed >= next.battle.opponentSpeed ? 'You move first' : 'Rival moves first')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open this battle.')
      setPhase('error')
    }
  }, [creature, embeddedWallet, walletAddress])

  const chooseAction = useCallback(
    async (action: BattleAction) => {
      if (!session || !creature || phase !== 'active') return
      setPhase('preparing')
      setMessage(
        action === 'guard' ? 'Bracing…' : action === 'instinct' ? `${instinctNameFor(creature)}…` : 'Striking…',
      )
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      try {
        const next = await playInteractiveTurn(session, action)
        const turn = next.turns[next.turns.length - 1]
        setSession(next)
        setPhase('resolving')
        reactToTurn(turn.playerDamage ?? 0, turn.opponentDamage ?? 0)
        const feedback = battleActionFeedback(action)
        playSound(feedback.sound)
        setMessage(
          action === 'guard'
            ? `Guarded ${turn.playerDamage ?? 0} damage · energy +2`
            : `${turn.opponentDamage ?? 0} damage dealt${turn.playerDamage ? ` · ${turn.playerDamage} received` : ''}`,
        )
        void Haptics.impactAsync(
          feedback.haptic === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
        )
        setTimeout(() => setPhase(next.battle.status === 'finished' ? 'settling' : 'active'), reduceMotion ? 0 : 240)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'That move did not resolve.')
        setPhase('active')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    },
    [creature, phase, reactToTurn, reduceMotion, session],
  )

  const settle = useCallback(async () => {
    if (!session) return
    setPhase('preparing')
    setMessage('Saving the result to Solana…')
    try {
      const next = await settleInteractiveBattle(session)
      setResult(next)
      setMessage(next.winner === 'player' ? 'Victory — your bond grows stronger' : 'A close match — recover and return')
      setPhase('result')
      const feedback = battleResultFeedback(next.winner)
      playSound(feedback.sound)
      void Haptics.notificationAsync(
        feedback.haptic === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The result could not settle yet.')
      setPhase('settling')
    }
  }, [session])

  const rival = creature ? cannedOpponentFor(creature) : null
  const battle = session?.battle
  const playerHp = battle?.playerHp ?? creature?.stats.hp ?? 0
  const rivalHp = battle?.opponentHp ?? rival?.hp ?? 0
  const playerMax = battle?.playerMaxHp ?? creature?.stats.hp ?? 1
  const rivalMax = battle?.opponentMaxHp ?? rival?.hp ?? 1
  const finished = phase === 'settling'

  // Once the match is delegated, the chain is the source of truth for both
  // sides' stats. Before that, the rival's are the local canned derivation —
  // so the read is available even while the arena is still opening.
  const combatInput: CombatInput | null =
    battle && creature
      ? {
          playerAttack: battle.playerAttack,
          playerDefense: battle.playerDefense,
          playerClass: battle.playerClass,
          playerTrait: battle.playerTrait,
          playerEnergy: battle.playerEnergy,
          playerSpeed: battle.playerSpeed,
          opponentAttack: battle.opponentAttack,
          opponentDefense: battle.opponentDefense,
          opponentClass: battle.opponentClass,
          opponentSpeed: battle.opponentSpeed,
        }
      : creature && rival
        ? {
            playerAttack: creature.stats.attack,
            playerDefense: creature.stats.defense,
            playerClass: CLASS_INDEX[ecologicalClassFor(creature)],
            playerTrait: passiveTraitIndex(creature),
            playerEnergy: 0,
            playerSpeed: creature.stats.speed,
            opponentAttack: rival.attack,
            opponentDefense: rival.defense,
            opponentClass: rival.ecologicalClass,
            opponentSpeed: rival.speed,
          }
        : null

  const matchup: Matchup | null = creature && rival ? matchupAgainst(creature, rival) : null

  // What each move would actually do, using the same arithmetic the program
  // will run. Null while the match is mid-flight, so the buttons never promise
  // a number the chain has already moved past.
  const previewFor = (action: BattleAction): TurnPreview | null => {
    if (!combatInput || !battle || phase !== 'active') return null
    return previewTurn({ input: combatInput, action, playerHp: battle.playerHp, opponentHp: battle.opponentHp })
  }

  /**
   * What the button promises, using the program's own arithmetic. Falls back to
   * the plain description whenever a number would be a guess.
   */
  const actionDetail = (action: BattleAction): string => {
    if (!creature) return ''
    const preview = previewFor(action)
    if (!preview || !combatInput || !battle) return actionDescription(action, creature)

    const bits: string[] = []
    if (action === 'guard') {
      bits.push(`−${100 - guardIncomingPercent(combatInput.playerTrait)}% incoming`)
    } else {
      bits.push(`${preview.damageToOpponent} damage`)
      if (preview.damageToOpponent >= battle.opponentHp) bits.push('finishing blow')
    }
    bits.push(action === 'instinct' ? `−${INSTINCT_COST} energy` : `+${action === 'guard' ? 2 : 1} energy`)
    if (preview.damageToPlayer > 0) bits.push(`${preview.damageToPlayer} back`)
    return bits.join(' · ')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>Wild match</Text>
        <Pressable
          onPress={() => setDetailsOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Onchain details"
        >
          <Ionicons name="information-circle" size={24} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.turnHeader}>
          <Text style={styles.turnLabel}>
            {battle ? `TURN ${battle.turn + (battle.status === 'active' ? 1 : 0)}` : 'CANNED RIVAL'}
          </Text>
          <Text style={styles.turnMessage}>{message}</Text>
        </View>

        {creature && rival ? (
          <View style={styles.arena}>
            <View style={styles.fighters}>
              <Animated.View style={[styles.fighter, { transform: [{ translateX: playerHit }] }]}>
                <Image source={{ uri: creature.cutoutUri || creature.photoUri }} style={styles.portrait} />
                <Text style={styles.fighterName} numberOfLines={1}>
                  {creature.nickname || creature.commonName}
                </Text>
                <Text style={styles.classLabel}>
                  {ecologicalClassFor(creature)} · SPD {battle?.playerSpeed ?? creature.stats.speed}
                </Text>
                <HpBar current={playerHp} max={playerMax} color={theme.colors.primary} />
                <Text style={styles.hpText}>
                  {Math.max(0, playerHp)} / {playerMax}
                </Text>
              </Animated.View>
              <Text style={styles.vs}>VS</Text>
              <Animated.View style={[styles.fighter, { transform: [{ translateX: rivalHit }] }]}>
                <Image source={rival.image} style={[styles.portrait, styles.rivalPortrait]} />
                <Text style={styles.fighterName} numberOfLines={1}>
                  {rival.commonName}
                </Text>
                <Text style={styles.classLabel}>
                  {rival.className} · SPD {battle?.opponentSpeed ?? rival.speed}
                </Text>
                <HpBar current={rivalHp} max={rivalMax} color="#C9A66B" />
                <Text style={styles.hpText}>
                  {Math.max(0, rivalHp)} / {rivalMax}
                </Text>
              </Animated.View>
            </View>

            {/* The class table in play_turn.rs is mechanical but was never
                surfaced. Showing it turns the matchup into something to play
                around rather than a hidden modifier. */}
            {matchup && matchup !== 'even' ? (
              <View style={[styles.matchupChip, matchup === 'advantage' ? styles.matchupGood : styles.matchupBad]}>
                <Ionicons
                  name={matchup === 'advantage' ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={matchup === 'advantage' ? theme.colors.primaryStrong : '#E0A66B'}
                />
                <Text style={styles.matchupText}>
                  {matchup === 'advantage'
                    ? `${ecologicalClassFor(creature)} beats ${rival.className}`
                    : `${rival.className} beats ${ecologicalClassFor(creature)}`}
                </Text>
                <Text
                  style={[
                    styles.matchupValue,
                    matchup === 'advantage' ? styles.matchupValueGood : styles.matchupValueBad,
                  ]}
                >
                  {matchup === 'advantage' ? '+20%' : '−20%'}
                </Text>
              </View>
            ) : null}

            {phase === 'ready' ? (
              <Text style={styles.rivalNote}>
                {rival.species} · {rival.note}
              </Text>
            ) : null}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.impactBurst,
                {
                  opacity: impactBurst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { scale: impactBurst.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.35] }) },
                    { rotate: '45deg' },
                  ],
                },
              ]}
            >
              <View style={[styles.impactParticle, styles.impactParticleTop]} />
              <View style={[styles.impactParticle, styles.impactParticleRight]} />
              <View style={[styles.impactParticle, styles.impactParticleBottom]} />
              <View style={[styles.impactParticle, styles.impactParticleLeft]} />
            </Animated.View>
            {battle ? (
              <View style={styles.energyRow}>
                <Text style={styles.energyLabel}>ENERGY</Text>
                {Array.from({ length: MAX_ENERGY }, (_, slot) => (
                  <View key={slot} style={[styles.energyDot, slot < battle.playerEnergy && styles.energyDotFilled]} />
                ))}
                <Text style={styles.traitText}>{creature.personality?.passiveTrait ?? 'Natural instinct'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          {phase === 'ready' || phase === 'error' ? (
            <ActionButton
              title="Start match"
              detail="Create and enter the MagicBlock arena"
              icon="play"
              onPress={() => void start()}
            />
          ) : phase === 'preparing' || phase === 'boot' || phase === 'resolving' ? (
            <ActivityIndicator color={theme.colors.primaryStrong} />
          ) : phase === 'active' && creature && battle ? (
            <>
              <ActionButton
                title="Strike"
                detail={actionDetail('strike')}
                icon="flash"
                onPress={() => void chooseAction('strike')}
              />
              <ActionButton
                title="Guard"
                detail={actionDetail('guard')}
                icon="shield"
                onPress={() => void chooseAction('guard')}
              />
              <ActionButton
                title={instinctNameFor(creature)}
                detail={actionDetail('instinct')}
                icon="sparkles"
                disabled={!combatInput || !canUseInstinct(combatInput)}
                onPress={() => void chooseAction('instinct')}
              />
            </>
          ) : finished ? (
            <ActionButton
              title="Finish battle"
              detail="Commit this result back to Solana"
              icon="checkmark"
              onPress={() => void settle()}
            />
          ) : (
            <ActionButton
              title="Back to sanctuary"
              detail={result?.progressionVerified ? 'Progress verified on Solana' : 'Result committed'}
              icon="leaf"
              onPress={() => router.replace('/')}
            />
          )}
        </View>
      </View>

      <OnchainDetails visible={detailsOpen} onClose={() => setDetailsOpen(false)} session={session} result={result} />
    </SafeAreaView>
  )
}

function ActionButton({
  title,
  detail,
  icon,
  onPress,
  disabled = false,
}: {
  title: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, disabled && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color="#171A17" />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
    </Pressable>
  )
}

function OnchainDetails({
  visible,
  onClose,
  session,
  result,
}: {
  visible: boolean
  onClose: () => void
  session: InteractiveBattleSession | null
  result: ErBattleResult | null
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.detailsPage}>
        <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle}>Onchain details</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.detailsContent}>
          <Text style={styles.detailsBody}>
            Each combat choice is one signed transaction on the MagicBlock Ephemeral Rollup.
          </Text>
          {(session?.turns ?? []).map((turn) => (
            <View key={turn.turn} style={styles.logRow}>
              <Text style={styles.logAction}>
                Turn {turn.turn} · {turn.action}
              </Text>
              <Text style={styles.logValue}>{turn.latencyMs} ms</Text>
            </View>
          ))}
          {session ? (
            <Pressable
              style={styles.explorerLink}
              onPress={() => void Linking.openURL(`https://explorer.solana.com/address/${session.pda}?cluster=devnet`)}
            >
              <Ionicons name="open-outline" size={17} color={theme.colors.primaryStrong} />
              <Text style={styles.explorerText}>View battle account</Text>
            </Pressable>
          ) : null}
          {result ? (
            <Text style={styles.detailsBody}>
              Settlement: {result.progressionVerified ? 'progression verified' : 'confirmation pending'}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  topBar: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  body: { flex: 1, paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  turnHeader: { alignItems: 'center', paddingTop: 8, minHeight: 56 },
  turnLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted },
  turnMessage: { marginTop: 4, fontSize: 17, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  arena: { paddingVertical: 16, gap: 16 },
  impactBurst: {
    position: 'absolute',
    top: 55,
    alignSelf: 'center',
    width: 34,
    height: 34,
  },
  impactParticle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.colors.primary,
  },
  impactParticleTop: { top: 0, left: 14 },
  impactParticleRight: { top: 14, right: 0 },
  impactParticleBottom: { bottom: 0, left: 14 },
  impactParticleLeft: { top: 14, left: 0 },
  fighters: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fighter: { flex: 1, alignItems: 'center', gap: 8 },
  portrait: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.surfaceRaised },
  rivalPortrait: { borderWidth: 2, borderColor: 'rgba(201, 166, 107, 0.55)' },
  fighterName: { fontSize: 14, fontWeight: '700', color: theme.colors.text, textTransform: 'uppercase' },
  classLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'capitalize' },
  hpTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceRaised,
  },
  hpFill: { width: '100%', height: '100%', transformOrigin: 'left center' },
  hpText: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
  vs: { fontSize: 11, fontWeight: '700', color: theme.colors.textFaint },
  matchupChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: theme.colors.surfaceRaised,
  },
  matchupGood: { backgroundColor: 'rgba(183, 243, 74, 0.14)' },
  matchupBad: { backgroundColor: 'rgba(224, 166, 107, 0.16)' },
  matchupText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  matchupValue: { fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  matchupValueGood: { color: theme.colors.primaryStrong },
  matchupValueBad: { color: '#E0A66B' },
  rivalNote: {
    marginTop: 2,
    paddingHorizontal: 8,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  energyRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  energyLabel: { marginRight: 4, fontSize: 10, fontWeight: '700', color: theme.colors.textMuted },
  energyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.surfaceRaised },
  energyDotFilled: { backgroundColor: theme.colors.primary },
  traitText: { marginLeft: 8, fontSize: 11, color: theme.colors.textMuted },
  actions: { marginTop: 'auto', gap: 8, minHeight: 72, justifyContent: 'flex-end' },
  actionButton: {
    minHeight: 64,
    borderRadius: 21,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  actionCopy: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  actionDetail: { marginTop: 2, fontSize: 12, color: theme.colors.textMuted },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  detailsPage: { flex: 1, backgroundColor: theme.colors.background },
  detailsHeader: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  detailsTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  done: { fontSize: 17, fontWeight: '600', color: theme.colors.primaryStrong },
  detailsContent: { padding: 20, gap: 12 },
  detailsBody: { fontSize: 15, lineHeight: 21, color: theme.colors.textMuted },
  logRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  logAction: { fontSize: 14, fontWeight: '600', color: theme.colors.text, textTransform: 'capitalize' },
  logValue: { fontSize: 13, color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
  explorerLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  explorerText: { fontSize: 15, fontWeight: '700', color: theme.colors.primaryStrong },
})
