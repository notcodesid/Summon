import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
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
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { theme } from '@/constants/theme'
import { MicroLabel, PrimaryButton } from '@/components/ui'
import { addToCollection } from '@/lib/collection'
import {
  RARITY_COLOR,
  RARITY_LABEL,
  type Creature,
  type Rarity,
} from '@/lib/creatures'
import {
  IdentifyError,
  identifyAnimal,
  isIdentifyLive,
  toCreature,
  type Identification,
} from '@/lib/identify'
import {
  clearPendingCapture,
  peekPendingCapture,
  takePendingCapture,
} from '@/lib/pending-capture'
import { persistCapturePhoto } from '@/lib/persist-photo'
import { usePlayer } from '@/lib/use-player'

type Capture = { id: string; photoUri: string; base64: string }

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
  /** Last capture id we started identifying — avoids reusing stale miss/found UI. */
  const activeCaptureIdRef = useRef<string | null>(null)
  const { privyUserId } = usePlayer()
  const liquid = isLiquidGlassAvailable()
  const { height: windowHeight } = useWindowDimensions()
  const heroHeight = Math.min(Math.round(windowHeight * 0.49), 456)

  const runIdentify = useCallback(async (capture: Capture) => {
    activeCaptureIdRef.current = capture.id
    setSaving(false)
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
        identification.isAnimal
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
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

      setPhase({
        status: 'found',
        capture,
        identification,
        displayName:
          identification.commonName ||
          identification.label ||
          identification.species,
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
      })
    }, [runIdentify]),
  )

  const goHome = useCallback(() => {
    router.replace('/')
  }, [])

  const onRetake = useCallback(() => {
    // Drop the rejected shot so camera opens clean for a new capture.
    clearPendingCapture()
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

    const identification: Identification = {
      ...phase.identification,
      commonName: name,
      species: phase.identification.species || name,
    }

    setSaving(true)
    try {
      const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
      const photoUri = await persistCapturePhoto(
        id,
        phase.capture.base64,
        phase.capture.photoUri,
      )
      const creature: Creature = toCreature(identification, photoUri, id)
      // Server uploads photo to Storage + inserts row (RLS locked).
      await addToCollection(creature, privyUserId, phase.capture.base64)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      router.replace('/collection')
    } catch {
      setSaving(false)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }, [phase, privyUserId, saving])

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
    return (
      <ScanStage
        photoUri={phase.capture.photoUri}
        heroHeight={heroHeight}
        liquid={liquid}
        eyebrow="scanning"
        title="Scanning photo"
        body="Looking for a real animal."
        footer={
          <View style={styles.scanningFooter}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
            <View style={styles.scanStatusRow}>
              <ActivityIndicator color={theme.colors.textMuted} size="small" />
              <Text style={styles.scanningHint}>analyzing image</Text>
            </View>
          </View>
        }
      />
    )
  }

  if (phase.status === 'no-capture') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.bootCenter}>
          <Ionicons
            name="alert-circle-outline"
            size={30}
            color={theme.colors.textFaint}
          />
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
              <Pressable
                onPress={onRetake}
                style={({ pressed }) => [styles.textLink, pressed && styles.buttonPressed]}
              >
                <Text style={styles.textLinkLabel}>retake</Text>
              </Pressable>
              <Pressable
                onPress={goHome}
                style={({ pressed }) => [styles.textLink, pressed && styles.buttonPressed]}
              >
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

  const form = (
    <View style={styles.formContent}>
      <View style={styles.formHeader}>
        <MicroLabel color={theme.colors.textMuted}>identified</MicroLabel>
        <Text style={styles.title}>{phase.displayName || 'Creature'}</Text>
        <View
          style={[
            styles.rarityPill,
            { backgroundColor: `${RARITY_COLOR[rarity]}22` },
          ]}
        >
          <Text style={[styles.rarityText, { color: RARITY_COLOR[rarity] }]}>
            {RARITY_LABEL[rarity]}
          </Text>
        </View>
        {species && species !== phase.displayName ? (
          <Text style={styles.speciesText}>{species}</Text>
        ) : null}
        {note ? <Text style={styles.noteText}>{note}</Text> : null}
      </View>

      <TextInput
        value={phase.displayName}
        onChangeText={(value) =>
          setPhase((prev) =>
            prev.status === 'found' ? { ...prev, displayName: value } : prev,
          )
        }
        placeholder="Animal name"
        placeholderTextColor={theme.colors.textFaint}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => void onKeep()}
        style={styles.nameInput}
        accessibilityLabel="Animal name"
      />
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroWrap}>
            <ScanPhoto
              uri={photoUri}
              height={Math.min(heroHeight, 360)}
              liquid={liquid}
            />
          </View>

          {liquid ? (
            <GlassContainer spacing={18} style={styles.stack}>
              <GlassView style={styles.formCard} glassEffectStyle="regular">
                {form}
              </GlassView>
              <GlassView style={styles.keepGlass} glassEffectStyle="regular" isInteractive>
                <KeepButton
                  saving={saving}
                  disabled={!phase.displayName.trim()}
                  onPress={onKeep}
                />
              </GlassView>
            </GlassContainer>
          ) : (
            <View style={styles.stack}>
              <View style={[styles.formCard, styles.fallbackCard]}>{form}</View>
              <View style={[styles.keepGlass, styles.fallbackCard]}>
                <KeepButton
                  saving={saving}
                  disabled={!phase.displayName.trim()}
                  onPress={onKeep}
                />
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
      <Image
        source={{ uri }}
        style={styles.scanPhotoImage}
        resizeMode="cover"
      />
    </View>
  )

  if (!liquid) return frame

  return (
    <GlassView
      style={[
        styles.scanPhotoGlass,
        fill ? styles.scanPhotoFrameFill : null,
        !fill ? { height } : null,
      ]}
      glassEffectStyle="regular"
    >
      <Image
        source={{ uri }}
        style={styles.scanPhotoImage}
        resizeMode="cover"
      />
    </GlassView>
  )
}

function KeepButton({
  saving,
  disabled,
  onPress,
}: {
  saving: boolean
  disabled: boolean
  onPress: () => void
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
      accessibilityLabel="Add to collection"
    >
      {saving ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <Ionicons name="add" size={22} color={theme.colors.text} />
      )}
      <Text style={styles.keepText}>{saving ? 'adding' : 'add to collection'}</Text>
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
})
