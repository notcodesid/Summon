import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { theme } from '@/constants/theme'
import {
  MicroLabel,
  PrimaryButton,
  QuietButton,
  RarityDot,
  Rule,
} from '@/components/ui'
import { addToCollection } from '@/lib/collection'
import { RARITY_COLOR, powerOf, type Creature } from '@/lib/creatures'
import { identifyAnimal, isIdentifyLive, toCreature } from '@/lib/identify'
import { takePendingCapture } from '@/lib/pending-capture'
import { usePlayer } from '@/lib/use-player'

type Phase =
  | { status: 'identifying' }
  | { status: 'found'; creature: Creature; live: boolean }
  | { status: 'no-animal'; photoUri: string }
  | { status: 'no-capture' }

/**
 * Post-capture: identify the animal, then let the player keep it.
 */
export default function RevealScreen() {
  const [phase, setPhase] = useState<Phase>({ status: 'identifying' })
  const [saving, setSaving] = useState(false)
  const startedRef = useRef(false)
  const { privyUserId } = usePlayer()

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const capture = takePendingCapture()
    if (!capture) {
      setPhase({ status: 'no-capture' })
      return
    }

    let cancelled = false
    void identifyAnimal(capture.base64).then((identification) => {
      if (cancelled) return
      if (!identification.isAnimal) {
        setPhase({ status: 'no-animal', photoUri: capture.uri })
        return
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setPhase({
        status: 'found',
        creature: toCreature(identification, capture.uri),
        live: identification.live,
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  const goHome = useCallback(() => {
    router.replace('/')
  }, [])

  const onKeep = useCallback(
    async (creature: Creature) => {
      if (saving) return
      setSaving(true)
      await addToCollection(creature, privyUserId)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      router.replace('/collection')
    },
    [saving, privyUserId],
  )

  if (phase.status === 'identifying') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
          <MicroLabel color={theme.colors.text}>identifying</MicroLabel>
          {!isIdentifyLive ? (
            <Text style={styles.footnote}>demo mode — no API key set</Text>
          ) : null}
        </View>
      </SafeAreaView>
    )
  }

  if (phase.status === 'no-capture') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle-outline"
            size={30}
            color={theme.colors.textFaint}
          />
          <Text style={styles.stateTitle}>nothing to identify</Text>
          <Text style={styles.stateBody}>that scan didn&apos;t come through.</Text>
          <View style={styles.stateAction}>
            <PrimaryButton label="back home" onPress={goHome} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (phase.status === 'no-animal') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Image source={{ uri: phase.photoUri }} style={styles.missPhoto} />
          <Text style={styles.stateTitle}>no animal found</Text>
          <Text style={styles.stateBody}>
            get closer and fill more of the frame — summon needs to see the
            animal clearly.
          </Text>
          <View style={styles.stateAction}>
            <PrimaryButton
              label="scan again"
              onPress={() => router.replace('/camera')}
            />
          </View>
          <QuietButton label="back home" onPress={goHome} />
        </View>
      </SafeAreaView>
    )
  }

  const { creature, live } = phase
  const accent = RARITY_COLOR[creature.rarity]

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.tagRow}>
          <MicroLabel color={theme.colors.textMuted}>caught</MicroLabel>
        </View>

        <Image source={{ uri: creature.photoUri }} style={styles.photo} />

        <View style={styles.identity}>
          <View style={styles.rarityRow}>
            <RarityDot color={accent} />
            <MicroLabel color={accent}>{creature.rarity}</MicroLabel>
          </View>
          <Text style={styles.name}>{creature.commonName}</Text>
          <Text style={styles.species}>{creature.species}</Text>
          {creature.note ? (
            <Text style={styles.note}>{creature.note}</Text>
          ) : null}
        </View>

        <Rule />

        <View style={styles.stats}>
          <StatRow label="hp" value={creature.stats.hp} accent={accent} />
          <StatRow label="atk" value={creature.stats.attack} accent={accent} />
          <StatRow label="def" value={creature.stats.defense} accent={accent} />
          <StatRow label="spd" value={creature.stats.speed} accent={accent} />
        </View>

        <Rule />

        <View style={styles.powerRow}>
          <MicroLabel>total power</MicroLabel>
          <Text style={styles.powerValue}>{powerOf(creature.stats)}</Text>
        </View>

        {!live ? (
          <Text style={styles.footnote}>
            demo creature — set an API key for real scans
          </Text>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={saving ? 'adding…' : 'add to collection'}
            onPress={() => void onKeep(creature)}
            disabled={saving}
            accessibilityLabel="Add to collection"
          />
          <QuietButton label="let it go" onPress={goHome} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const MAX_STAT = 100

function StatRow({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  const width = `${Math.min(100, (value / MAX_STAT) * 100)}%` as const
  return (
    <View style={styles.statRow}>
      <View style={styles.statLabel}>
        <MicroLabel>{label}</MicroLabel>
      </View>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width, backgroundColor: accent }]} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.section,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxl,
    gap: theme.space.md,
  },
  tagRow: {
    alignItems: 'center',
    paddingBottom: theme.space.lg,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceRaised,
  },
  identity: {
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.xl,
    gap: theme.space.xs,
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: theme.space.sm,
  },
  name: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: theme.colors.text,
  },
  species: {
    fontSize: 15,
    fontStyle: 'italic',
    color: theme.colors.textMuted,
  },
  note: {
    marginTop: theme.space.md,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text,
  },
  stats: {
    paddingVertical: theme.space.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.md,
  },
  statLabel: {
    width: 34,
  },
  statTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden',
  },
  statFill: {
    height: '100%',
    borderRadius: 999,
  },
  statValue: {
    width: 30,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.lg,
  },
  powerValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    fontSize: 12,
    color: theme.colors.textFaint,
    textAlign: 'center',
  },
  actions: {
    marginTop: theme.space.xl,
    gap: theme.space.lg,
    alignItems: 'center',
  },
  stateTitle: {
    marginTop: theme.space.xs,
    fontSize: theme.type.title.fontSize,
    fontWeight: theme.type.title.fontWeight,
    letterSpacing: theme.type.title.letterSpacing,
    color: theme.colors.text,
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  stateAction: {
    marginTop: theme.space.lg,
    alignSelf: 'stretch',
    paddingHorizontal: theme.space.xxl,
  },
  missPhoto: {
    width: 132,
    height: 132,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceRaised,
  },
})
