import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useEmbeddedSolanaWallet } from '@privy-io/expo'
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { theme } from '@/constants/theme'
import { MicroLabel, PrimaryButton } from '@/components/ui'
import { SpecimenCard } from '@/components/specimen-card'
import { playSound, revealSoundFor } from '@/lib/audio'
import { newCatchIdHex } from '@/lib/catch-id'
import { addToCollection } from '@/lib/collection'
import { keepCreatureOnchain } from '@/lib/collect-onchain'
import { personalityFor, type CreaturePersonality } from '@/lib/creature-personality'
import { RARITY_COLOR, statsFor, type CaptureGrade, type Creature, type Rarity } from '@/lib/creatures'
import type { SignAndSendProvider } from '@/lib/onchain-player'
import { IdentifyError, identifyAnimal, isIdentifyLive, toCreature, type Identification } from '@/lib/identify'
import { clearPendingCapture, peekPendingCapture, takePendingCapture } from '@/lib/pending-capture'
import { persistCapturePhoto } from '@/lib/persist-photo'
import { usePlayer } from '@/lib/use-player'

type Capture = {
  id: string
  photoUri: string
  base64: string
  captureGrade: CaptureGrade
  captureBonusXp: number
  captureTrait: string
}
type SaveNotice = { kind: 'pending' | 'failed'; message: string }
type SaveAttempt = { creature: Creature; imageBase64: string }

const GRADE_REWARD: Record<CaptureGrade, number> = { good: 10, great: 25, perfect: 50 }
const GRADE_RANK: CaptureGrade[] = ['good', 'great', 'perfect']

function combinedGrade(timing: CaptureGrade, quality: CaptureGrade): CaptureGrade {
  const average = Math.round((GRADE_RANK.indexOf(timing) + GRADE_RANK.indexOf(quality)) / 2)
  return GRADE_RANK[average]
}

type Phase =
  | { status: 'boot' }
  | { status: 'no-capture' }
  | { status: 'identifying'; capture: Capture }
  | { status: 'miss'; capture: Capture; label: string; message: string }
  | { status: 'error'; capture: Capture; message: string }
  | {
      status: 'found'
      capture: Capture
      identification: Identification
      displayName: string
    }

/** After capture: identify with Gemini, then keep to collection. */
export default function RevealScreen() {
  const [phase, setPhase] = useState<Phase>({ status: 'boot' })
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null)
  /** Last capture id we started identifying — avoids reusing stale miss/found UI. */
  const activeCaptureIdRef = useRef<string | null>(null)
  /** Keeps retries idempotent after a failed or pending remote save. */
  const saveAttemptRef = useRef<SaveAttempt | null>(null)
  const { privyUserId, walletAddress } = usePlayer()
  const solana = useEmbeddedSolanaWallet()
  const embeddedWallet = 'wallets' in solana ? (solana.wallets ?? [])[0] : undefined
  const liquid = isLiquidGlassAvailable()
  const { height: windowHeight } = useWindowDimensions()
  const heroHeight = Math.min(Math.round(windowHeight * 0.49), 456)

  const runIdentify = useCallback(async (capture: Capture) => {
    activeCaptureIdRef.current = capture.id
    saveAttemptRef.current = null
    setSaving(false)
    setSaveNotice(null)
    setPhase({ status: 'identifying', capture })
    try {
      if (!isIdentifyLive) {
        if (activeCaptureIdRef.current !== capture.id) return
        setPhase({
          status: 'error',
          capture,
          message: 'Animal scan is not set up on this build.',
        })
        return
      }

      const identification = await identifyAnimal(capture.base64)
      // A newer retake may have started while this request was in flight.
      if (activeCaptureIdRef.current !== capture.id) return

      void Haptics.notificationAsync(
        identification.isAnimal ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      )

      if (!identification.isAnimal) {
        setPhase({
          status: 'miss',
          capture,
          label: identification.label,
          message: identification.message,
        })
        return
      }

      const captureGrade = combinedGrade(capture.captureGrade, identification.photoQuality)
      const gradedCapture: Capture = {
        ...capture,
        captureGrade,
        captureBonusXp: GRADE_REWARD[captureGrade],
        captureTrait: identification.qualityNote || capture.captureTrait,
      }

      // The sting scales with the tier, so a legendary announces itself before
      // a single word of the card has been read.
      playSound(revealSoundFor(identification.rarity))
      setPhase({
        status: 'found',
        capture: gradedCapture,
        identification,
        displayName: '',
      })
    } catch (error) {
      if (activeCaptureIdRef.current !== capture.id) return
      const message =
        error instanceof IdentifyError
          ? error.userMessage
          : error instanceof Error
            ? error.message
            : 'Could not scan this photo — retake and try again.'
      setPhase({ status: 'error', capture, message })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }, [])

  // Reveal often stays mounted in the tab stack. Re-run whenever we focus with
  // a *new* pending capture (retake → use photo), not only on first mount.
  useFocusEffect(
    useCallback(() => {
      const pending = peekPendingCapture()
      if (!pending) {
        // First open with nothing to scan.
        if (activeCaptureIdRef.current === null) {
          setPhase({ status: 'no-capture' })
        }
        return
      }

      // Same shot already on screen / in flight — leave state alone.
      if (pending.id === activeCaptureIdRef.current) {
        takePendingCapture()
        return
      }

      const taken = takePendingCapture()
      if (!taken) return

      void runIdentify({
        id: taken.id,
        photoUri: taken.uri,
        base64: taken.base64,
        captureGrade: taken.captureGrade,
        captureBonusXp: taken.captureBonusXp,
        captureTrait: taken.captureTrait,
      })
    }, [runIdentify]),
  )

  const goHome = useCallback(() => {
    router.replace('/')
  }, [])

  const onRetake = useCallback(() => {
    // Drop the rejected shot so camera opens clean for a new capture.
    clearPendingCapture()
    saveAttemptRef.current = null
    setSaveNotice(null)
    router.replace('/camera')
  }, [])

  const onRetry = useCallback(() => {
    if (phase.status === 'error') {
      void runIdentify(phase.capture)
    }
  }, [phase, runIdentify])

  const onKeep = useCallback(async () => {
    if (saving || phase.status !== 'found') return

    const name = phase.displayName.trim()
    if (!name) return

    const identification = phase.identification

    if (!privyUserId || !walletAddress || !embeddedWallet) {
      setSaveNotice({
        kind: 'failed',
        message: 'Wallet is still opening. Wait a second and tap Keep again.',
      })
      return
    }

    setSaving(true)
    setSaveNotice(null)
    try {
      const previous = saveAttemptRef.current
      const attempt: SaveAttempt = previous
        ? {
            ...previous,
            creature: {
              ...previous.creature,
              nickname: name,
              commonName: identification.commonName || identification.label,
              species: identification.species,
              rarity: identification.rarity,
              note: identification.note,
              stats: statsFor(identification.species, identification.rarity),
            },
          }
        : (() => {
            const id = newCatchIdHex()
            return {
              creature: {
                ...toCreature(identification, '', id),
                captureGrade: phase.capture.captureGrade,
                captureBonusXp: phase.capture.captureBonusXp,
                captureTrait: phase.capture.captureTrait,
                personality: personalityFor({
                  captureId: phase.capture.id,
                  species: identification.species,
                  captureGrade: phase.capture.captureGrade,
                }),
                bondLevel: 1,
              },
              imageBase64: phase.capture.base64,
            }
          })()

      if (!attempt.creature.localPhotoUri) {
        const localPhotoUri = await persistCapturePhoto(
          attempt.creature.id,
          attempt.imageBase64,
          phase.capture.photoUri,
        )
        attempt.creature.localPhotoUri = localPhotoUri
        attempt.creature.photoUri = localPhotoUri
      }
      saveAttemptRef.current = attempt

      const wallet = embeddedWallet
      const chain = await keepCreatureOnchain({
        walletAddress,
        creature: attempt.creature,
        imageBase64: attempt.imageBase64,
        getProvider: () => wallet.getProvider() as Promise<SignAndSendProvider>,
      })

      if (!chain.ok) {
        setSaving(false)
        setSaveNotice({ kind: 'failed', message: chain.message })
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return
      }

      const result = await addToCollection(attempt.creature, privyUserId, attempt.imageBase64)

      if (result.status === 'saved' || result.status === 'pending') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        saveAttemptRef.current = null
        router.replace('/')
        return
      }

      setSaving(false)
      setSaveNotice({ kind: result.status, message: result.message })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } catch {
      setSaving(false)
      setSaveNotice({
        kind: 'failed',
        message: 'Could not prepare this photo to save. Please try again.',
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }, [embeddedWallet, phase, privyUserId, saving, walletAddress])

  if (phase.status === 'boot') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.bootCenter}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (phase.status === 'identifying') {
    return <ScanningCheckingScreen photoUri={phase.capture.photoUri} heroHeight={heroHeight} />
  }

  if (phase.status === 'no-capture') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.bootCenter}>
          <Ionicons name="alert-circle-outline" size={30} color={theme.colors.textFaint} />
          <Text style={styles.panelTitle}>nothing to add</Text>
          <Text style={styles.panelBody}>that photo didn&apos;t come through.</Text>
          <View style={styles.panelAction}>
            <PrimaryButton label="back home" onPress={goHome} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (phase.status === 'miss') {
    return (
      <ScanStage
        photoUri={phase.capture.photoUri}
        heroHeight={heroHeight}
        liquid={liquid}
        eyebrow="not collectible"
        title={phase.label || 'Not an animal'}
        body="Not a real animal. Try a clear photo of a living animal."
        footer={
          <View style={styles.panelActions}>
            <PrimaryButton label="retake photo" onPress={onRetake} />
            <Pressable
              onPress={goHome}
              style={({ pressed }) => [styles.textLink, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Back home"
            >
              <Text style={styles.textLinkLabel}>back home</Text>
            </Pressable>
          </View>
        }
      />
    )
  }

  if (phase.status === 'error') {
    return (
      <ScanStage
        photoUri={phase.capture.photoUri}
        heroHeight={heroHeight}
        liquid={liquid}
        eyebrow="scan issue"
        title="Couldn’t finish the scan"
        body={phase.message}
        footer={
          <View style={styles.panelActions}>
            <PrimaryButton label="try again" onPress={onRetry} />
            <View style={styles.footerLinks}>
              <Pressable onPress={onRetake} style={({ pressed }) => [styles.textLink, pressed && styles.buttonPressed]}>
                <Text style={styles.textLinkLabel}>retake</Text>
              </Pressable>
              <Pressable onPress={goHome} style={({ pressed }) => [styles.textLink, pressed && styles.buttonPressed]}>
                <Text style={styles.textLinkLabel}>back home</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    )
  }

  // found
  const photoUri = phase.capture.photoUri
  const rarity: Rarity = phase.identification.rarity
  const note = phase.identification.note
  const species = phase.identification.species
  const stats = statsFor(species, rarity)
  const personality = personalityFor({
    captureId: phase.capture.id,
    species,
    captureGrade: phase.capture.captureGrade,
  })

  const specimenData = {
    species,
    commonName: phase.identification.commonName,
    nickname: phase.displayName || undefined,
    rarity,
    stats,
    note,
    photoUri,
    personality,
    bondLevel: 1,
  }

  const form = (
    <View style={styles.formContent}>
      <View style={styles.formHeader}>
        <MicroLabel color={theme.colors.textMuted}>NAME THIS CREATURE</MicroLabel>
      </View>

      <TextInput
        value={phase.displayName}
        onChangeText={(value) => setPhase((prev) => (prev.status === 'found' ? { ...prev, displayName: value } : prev))}
        placeholder={`Nickname your ${phase.identification.commonName.toLowerCase()}`}
        placeholderTextColor={theme.colors.textFaint}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => void onKeep()}
        style={styles.nameInput}
        accessibilityLabel="Creature nickname"
      />
      {saveNotice ? (
        <View
          style={[
            styles.saveNotice,
            saveNotice.kind === 'pending' ? styles.saveNoticePending : styles.saveNoticeFailed,
          ]}
          accessibilityRole="alert"
        >
          <Ionicons
            name={saveNotice.kind === 'pending' ? 'cloud-upload-outline' : 'alert-circle-outline'}
            size={18}
            color={theme.colors.text}
          />
          <Text style={styles.saveNoticeText}>{saveNotice.message}</Text>
        </View>
      ) : null}
    </View>
  )

  const keepLabel = saveNotice?.kind === 'pending' ? 'try upload again' : 'add to collection'

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Interactive 2.5D Holographic Specimen Card */}
          <FoundHero rarity={rarity} grade={phase.capture.captureGrade}>
            <SpecimenCard creature={specimenData} />
          </FoundHero>

          <View style={styles.discoverySummary}>
            <View style={styles.discoveryHeading}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLOR[rarity] }]} />
              <Text style={styles.discoveryEyebrow}>{rarity.toUpperCase()} ENCOUNTER</Text>
            </View>
            <Text style={styles.discoveryTitle}>{phase.displayName || phase.identification.commonName}</Text>
            <Text style={styles.discoverySpecies}>{species}</Text>
            <Text style={styles.discoveryNote}>{note || 'A new individual for your field collection.'}</Text>
            <View style={styles.rewardRows}>
              <RewardRow icon="sparkles-outline" label="Field craft" value={phase.capture.captureTrait} />
              <RewardRow
                icon="ribbon-outline"
                label="Capture grade"
                value={`${phase.capture.captureGrade} · +${phase.capture.captureBonusXp} XP`}
              />
              <RewardRow icon="lock-open-outline" label="Unlocked" value="Collection card" />
            </View>
            <PersonalityGrid personality={personality} bondLevel={1} />
            <Text style={styles.nextHint}>Next: name it, then add it to your collection.</Text>
          </View>

          {liquid ? (
            <GlassContainer spacing={14} style={styles.stack}>
              <GlassView style={styles.formCard} glassEffectStyle="regular">
                {form}
              </GlassView>
              <GlassView style={styles.keepGlass} glassEffectStyle="regular" isInteractive>
                <KeepButton saving={saving} disabled={!phase.displayName.trim()} onPress={onKeep} label={keepLabel} />
              </GlassView>
            </GlassContainer>
          ) : (
            <View style={styles.stack}>
              <View style={[styles.formCard, styles.fallbackCard]}>{form}</View>
              <View style={[styles.keepGlass, styles.fallbackCard]}>
                <KeepButton saving={saving} disabled={!phase.displayName.trim()} onPress={onKeep} label={keepLabel} />
              </View>
            </View>
          )}

          <View style={styles.footerLinks}>
            <Pressable
              onPress={onRetake}
              style={({ pressed }) => [styles.textLink, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
            >
              <Text style={styles.textLinkLabel}>retake</Text>
            </Pressable>
            <Pressable
              onPress={goHome}
              style={({ pressed }) => [styles.textLink, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel and return home"
            >
              <Text style={styles.textLinkLabel}>cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function RewardRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.rewardRow}>
      <Ionicons name={icon} size={18} color={theme.colors.textMuted} />
      <Text style={styles.rewardLabel}>{label}</Text>
      <Text style={styles.rewardValue}>{value}</Text>
    </View>
  )
}

function PersonalityGrid({ personality, bondLevel }: { personality: CreaturePersonality; bondLevel: number }) {
  const items = [
    { label: 'Temperament', value: personality.temperament },
    { label: 'Build', value: personality.sizeVariation },
    { label: 'Passive', value: personality.passiveTrait },
    { label: 'Affinity', value: personality.habitatAffinity },
    { label: 'Card finish', value: personality.cardVariation },
    { label: 'Bond', value: `Level ${bondLevel}` },
  ]

  return (
    <View style={styles.personalitySection}>
      <Text style={styles.personalityTitle}>THIS INDIVIDUAL</Text>
      <View style={styles.personalityGrid}>
        {items.map((item) => (
          <View key={item.label} style={styles.personalityItem}>
            <Text style={styles.personalityLabel}>{item.label}</Text>
            <Text style={styles.personalityValue} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.personalityFootnote}>
        Game traits describe this collectible, not the animal’s real behavior.
      </Text>
    </View>
  )
}

/**
 * How much of a moment each tier gets. A common should feel like a good find;
 * a legendary should stop you where you stand.
 */
const REVEAL_TIERS: Record<Rarity, { particles: number; rings: number; flash: number }> = {
  common: { particles: 6, rings: 0, flash: 0 },
  uncommon: { particles: 9, rings: 0, flash: 0 },
  rare: { particles: 12, rings: 1, flash: 0 },
  epic: { particles: 16, rings: 1, flash: 0.16 },
  legendary: { particles: 22, rings: 2, flash: 0.3 },
}

/**
 * Sparks on a loose ring around the card. Deterministic, so a species always
 * celebrates the same way instead of reshuffling on every re-render.
 */
function sparkPositions(count: number): { left: `${number}%`; top: `${number}%` }[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.45
    const radius = 40 + ((index * 37) % 20)
    return {
      left: `${50 + Math.cos(angle) * radius}%`,
      top: `${50 + Math.sin(angle) * radius * 0.8}%`,
    }
  })
}

function FoundHero({ rarity, grade, children }: { rarity: Rarity; grade: CaptureGrade; children: ReactNode }) {
  const entrance = useRef(new Animated.Value(0)).current
  const particle = useRef(new Animated.Value(0)).current
  const ring = useRef(new Animated.Value(0)).current
  const flash = useRef(new Animated.Value(0)).current
  const [reduceMotion, setReduceMotion] = useState(false)

  const tier = REVEAL_TIERS[rarity]
  const sparks = sparkPositions(tier.particles)

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    entrance.setValue(reduceMotion ? 1 : 0)
    particle.setValue(0)
    ring.setValue(0)
    flash.setValue(reduceMotion ? 0 : tier.flash)
    if (reduceMotion) return

    Animated.parallel([
      Animated.spring(entrance, {
        toValue: 1,
        damping: 18,
        stiffness: rarity === 'legendary' || rarity === 'epic' ? 150 : 190,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(particle, {
        toValue: 1,
        duration: grade === 'perfect' ? 900 : 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ring, {
        toValue: 1,
        duration: rarity === 'legendary' ? 1000 : 820,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0,
        duration: 560,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }, [entrance, flash, grade, particle, rarity, reduceMotion, ring, tier.flash])

  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] })
  const scale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] })
  const particleScale = particle.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.25] })
  const particleOpacity = particle.interpolate({ inputRange: [0, 0.32, 1], outputRange: [0, 0.9, 0] })
  const outerRingScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.3] })
  const innerRingScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.75] })
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.55, 0] })

  return (
    <View style={styles.heroWrap}>
      {/* A tint of the tier's own colour, so even the edge of the screen tells
          you what you found before the card finishes arriving. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.revealFlash, { backgroundColor: RARITY_COLOR[rarity], opacity: flash }]}
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.particleField, { opacity: particleOpacity, transform: [{ scale: particleScale }] }]}
      >
        {sparks.map((position, index) => (
          <View key={index} style={[styles.particle, position, { backgroundColor: RARITY_COLOR[rarity] }]} />
        ))}
      </Animated.View>

      {!reduceMotion && tier.rings > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.revealRing,
            { borderColor: RARITY_COLOR[rarity], opacity: ringOpacity, transform: [{ scale: outerRingScale }] },
          ]}
        />
      ) : null}
      {!reduceMotion && tier.rings > 1 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.revealRing,
            { borderColor: RARITY_COLOR[rarity], opacity: ringOpacity, transform: [{ scale: innerRingScale }] },
          ]}
        />
      ) : null}

      <Animated.View style={{ opacity: entrance, transform: [{ translateY }, { scale }] }}>{children}</Animated.View>
    </View>
  )
}

/** Full-bleed photo + calm copy + actions. Used for scan / miss / error. */
function ScanStage({
  photoUri,
  heroHeight,
  liquid,
  eyebrow,
  title,
  body,
  footer,
}: {
  photoUri: string
  heroHeight: number
  liquid: boolean
  eyebrow: string
  title: string
  body: string
  footer: ReactNode
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.stage}>
        <View style={styles.stagePhotoSlot}>
          <ScanPhoto uri={photoUri} height={heroHeight} liquid={liquid} fill />
        </View>

        {/* Same lens as the identifying screen, glass dark: it was on while
            searching, it is off because nothing was found. */}
        <View style={styles.stageCharacterSlot} pointerEvents="none">
          <Image source={require('@/assets/scan-miss.png')} style={styles.stageCharacter} resizeMode="contain" />
        </View>

        <View style={styles.stagePanel}>
          <MicroLabel color={theme.colors.textFaint}>{eyebrow}</MicroLabel>
          <Text style={styles.panelTitle} numberOfLines={3}>
            {title}
          </Text>
          <Text style={styles.panelBody}>{body}</Text>
          {footer}
        </View>
      </View>
    </SafeAreaView>
  )
}

function ScanPhoto({
  uri,
  height,
  liquid,
  fill = false,
}: {
  uri: string
  height: number
  liquid: boolean
  fill?: boolean
}) {
  const frame = (
    <View
      style={[
        styles.scanPhotoFrame,
        fill ? styles.scanPhotoFrameFill : null,
        !fill ? { height } : null,
        !liquid && styles.fallbackCard,
      ]}
    >
      <Image source={{ uri }} style={styles.scanPhotoImage} resizeMode="cover" />
    </View>
  )

  if (!liquid) return frame

  return (
    <GlassView
      style={[styles.scanPhotoGlass, fill ? styles.scanPhotoFrameFill : null, !fill ? { height } : null]}
      glassEffectStyle="regular"
    >
      <Image source={{ uri }} style={styles.scanPhotoImage} resizeMode="cover" />
    </GlassView>
  )
}

function KeepButton({
  saving,
  disabled,
  onPress,
  label,
}: {
  saving: boolean
  disabled: boolean
  onPress: () => void
  label: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={saving || disabled}
      style={({ pressed }) => [
        styles.keepButton,
        (saving || disabled) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {saving ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <Ionicons name="add" size={22} color={theme.colors.text} />
      )}
      <Text style={styles.keepText}>{saving ? 'saving' : label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.section,
  },
  bootCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxl,
    gap: theme.space.md,
  },

  // —— Scan status layout (identifying / miss / error) ——
  stage: {
    flex: 1,
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xl,
    gap: theme.space.lg,
  },
  stagePhotoSlot: {
    flex: 1,
    minHeight: 266,
    maxHeight: 494,
  },
  stageCharacterSlot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -theme.space.xl,
    marginBottom: -theme.space.lg,
  },
  stageCharacter: {
    width: 150,
    height: 150,
  },
  stagePanel: {
    gap: theme.space.xs,
    paddingTop: theme.space.xs,
    paddingBottom: theme.space.sm,
  },
  scanPhotoGlass: {
    borderRadius: 32,
    overflow: 'hidden',
    width: '100%',
  },
  scanPhotoFrame: {
    borderRadius: 32,
    overflow: 'hidden',
    width: '100%',
    backgroundColor: theme.colors.surfaceRaised,
  },
  scanPhotoFrameFill: {
    flex: 1,
    width: '100%',
    minHeight: 266,
  },
  scanPhotoImage: {
    width: '100%',
    height: '100%',
  },
  panelTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: theme.colors.text,
    lineHeight: 34,
  },
  panelBody: {
    fontSize: 16,
    lineHeight: 23,
    color: theme.colors.textMuted,
    marginTop: 2,
    marginBottom: theme.space.sm,
  },
  panelAction: {
    alignSelf: 'stretch',
    marginTop: theme.space.md,
  },
  panelActions: {
    gap: theme.space.md,
    marginTop: theme.space.sm,
  },
  scanningFooter: {
    gap: theme.space.sm,
    minHeight: 58,
    marginTop: theme.space.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceRaised,
  },
  progressFill: {
    width: '68%',
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  scanStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  scanningHint: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  textLink: {
    alignSelf: 'center',
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.md,
  },
  textLinkLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },

  // —— Found / keep ——
  heroWrap: {
    alignItems: 'center',
    marginBottom: theme.space.lg,
    width: '100%',
    position: 'relative',
  },
  particleField: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  revealFlash: {
    position: 'absolute',
    top: -theme.space.lg,
    left: -theme.space.lg,
    right: -theme.space.lg,
    bottom: -theme.space.lg,
    zIndex: 0,
  },
  revealRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 240,
    height: 240,
    marginLeft: -120,
    marginTop: -120,
    borderRadius: 120,
    borderWidth: 2,
    zIndex: 1,
  },
  discoverySummary: {
    borderRadius: theme.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.space.lg,
    marginBottom: theme.space.md,
  },
  discoveryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  discoveryEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  discoveryTitle: {
    marginTop: theme.space.sm,
    color: theme.colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  discoverySpecies: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  discoveryNote: {
    marginTop: theme.space.md,
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  rewardRows: {
    marginTop: theme.space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  rewardRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rewardLabel: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  rewardValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  personalitySection: {
    marginTop: theme.space.lg,
  },
  personalityTitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  personalityGrid: {
    marginTop: theme.space.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  personalityItem: {
    width: '50%',
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: theme.space.sm,
    paddingRight: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  personalityLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  personalityValue: {
    marginTop: 2,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  personalityFootnote: {
    marginTop: theme.space.sm,
    color: theme.colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
  },
  nextHint: {
    marginTop: theme.space.md,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stack: {
    gap: theme.space.md,
  },
  formCard: {
    borderRadius: 34,
    overflow: 'hidden',
    padding: theme.space.lg,
  },
  fallbackCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  formContent: {
    gap: theme.space.lg,
  },
  formHeader: {
    gap: theme.space.xs,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.colors.text,
  },
  rarityPill: {
    alignSelf: 'flex-start',
    marginTop: theme.space.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  rarityText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  speciesText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  noteText: {
    marginTop: theme.space.sm,
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.textMuted,
  },
  nameInput: {
    minHeight: 58,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.lg,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  saveNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.sm,
    borderRadius: theme.radius.button,
    borderWidth: 1,
    padding: theme.space.md,
  },
  saveNoticePending: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  saveNoticeFailed: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.border,
  },
  saveNoticeText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  keepGlass: {
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  keepButton: {
    minHeight: 58,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
  },
  keepText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  footerLinks: {
    marginTop: theme.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xl,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  checkingContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'space-between',
    gap: 16,
    backgroundColor: '#0F1411',
  },
  checkingPhotoCard: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#182019',
    borderWidth: 1.5,
    borderColor: 'rgba(183, 243, 74, 0.35)',
    shadowColor: '#B7F34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  laserScanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    backgroundColor: '#B7F34A',
    shadowColor: '#B7F34A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  hudCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#B7F34A',
    zIndex: 15,
  },
  hudTopLeft: {
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  hudTopRight: {
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  hudBottomLeft: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  hudBottomRight: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  hudBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(24, 32, 25, 0.92)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(183, 243, 74, 0.4)',
    zIndex: 15,
  },
  hudBadgeText: {
    color: '#B7F34A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  checkingCharacterSlot: {
    height: 168,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -12,
    marginBottom: -12,
    overflow: 'visible',
    zIndex: 5,
  },
  checkingCharacter: {
    width: 220,
    height: 298,
    // The transparent artwork is taller than its stage so the explorer rises
    // over the photo while the signal card visually anchors his lower edge.
    marginBottom: -36,
  },
  checkingInfoCard: {
    backgroundColor: '#182019',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(183, 243, 74, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  checkingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkingEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B7F34A',
    letterSpacing: 1,
  },
  checkingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F5F2E9',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  checkingTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#222C23',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(183, 243, 74, 0.2)',
  },
  checkingFill: {
    height: '100%',
    backgroundColor: '#B7F34A',
    borderRadius: 5,
  },
  checkingSubtext: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA69D',
    textAlign: 'center',
  },
})

function ScanningCheckingScreen({ photoUri, heroHeight }: { photoUri: string; heroHeight: number }) {
  const scanAnim = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0.1)).current
  const [stepText, setStepText] = useState('Looking closer at the real world…')

  useEffect(() => {
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )
    scanLoop.start()

    // Monotonic and decelerating: identify takes an unknown time, so the bar
    // creeps toward completion and never reaches it or resets. A looping bar
    // reads as broken, because progress that runs backwards means nothing.
    const progress = Animated.sequence([
      Animated.timing(progressAnim, {
        toValue: 0.55,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.8,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.93,
        duration: 4000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.98,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ])
    progress.start()

    const steps = ['Looking closer at the real world…', 'Working out what you found…', 'Almost there…']
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep += 1
      if (currentStep >= steps.length) {
        clearInterval(interval)
        return
      }
      setStepText(steps[currentStep])
    }, 1800)

    return () => {
      scanLoop.stop()
      progress.stop()
      clearInterval(interval)
    }
  }, [scanAnim, progressAnim])

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, heroHeight - 12],
  })

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#0F1411' }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.checkingContainer}>
        {/* Photo Container with HUD Corners & Laser Scanner Line */}
        <View style={[styles.checkingPhotoCard, { height: heroHeight }]}>
          <Image source={{ uri: photoUri }} style={styles.scanPhotoImage} resizeMode="cover" />

          {/* Laser Scanning Line */}
          <Animated.View
            style={[
              styles.laserScanLine,
              {
                transform: [{ translateY }],
              },
            ]}
          />

          {/* HUD Reticle Corners */}
          <View style={[styles.hudCorner, styles.hudTopLeft]} />
          <View style={[styles.hudCorner, styles.hudTopRight]} />
          <View style={[styles.hudCorner, styles.hudBottomLeft]} />
          <View style={[styles.hudCorner, styles.hudBottomRight]} />

          <View style={styles.hudBadge}>
            <Text style={styles.hudBadgeText}>✦ DISCOVERING</Text>
          </View>
        </View>

        {/* The player doing the looking. Sits between the photo and the signal
            card so the readout below reads as what he is seeing. */}
        <View
          style={styles.checkingCharacterSlot}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Image
            source={require('@/assets/scan-identifying.png')}
            style={styles.checkingCharacter}
            resizeMode="contain"
          />
        </View>

        {/* Scanning Info & Progress Card */}
        <View style={styles.checkingInfoCard}>
          <View style={styles.checkingHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkingEyebrow}>✦ DISCOVERY SIGNAL</Text>
              <Text style={styles.checkingTitle}>Identifying...</Text>
            </View>
          </View>

          {/* Animated Progress Bar */}
          <View style={styles.checkingTrack}>
            <Animated.View style={[styles.checkingFill, { width: progressWidth }]} />
          </View>

          <Text style={styles.checkingSubtext}>{stepText}</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
