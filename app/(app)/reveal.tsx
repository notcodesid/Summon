import { useCallback, useEffect, useRef, useState } from 'react'
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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { theme } from '@/constants/theme'
import { MicroLabel, PrimaryButton } from '@/components/ui'
import { addToCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { takePendingCapture } from '@/lib/pending-capture'
import { persistCapturePhoto } from '@/lib/persist-photo'
import { usePlayer } from '@/lib/use-player'

type Phase =
  | { status: 'loading' }
  | { status: 'ready'; photoUri: string; base64: string }
  | { status: 'no-capture' }

/** Post-capture: name the photo manually, then add it to the collection. */
export default function RevealScreen() {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const startedRef = useRef(false)
  const { privyUserId } = usePlayer()
  const liquid = isLiquidGlassAvailable()

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const capture = takePendingCapture()
    if (!capture) {
      setPhase({ status: 'no-capture' })
      return
    }

    setPhase({
      status: 'ready',
      photoUri: capture.uri,
      base64: capture.base64,
    })
  }, [])

  const goHome = useCallback(() => {
    router.replace('/')
  }, [])

  const onKeep = useCallback(async () => {
    if (phase.status !== 'ready' || saving) return

    const cleanName = name.trim()
    if (!cleanName) return

    setSaving(true)
    const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    // Camera cache URIs expire — copy into permanent app storage first.
    const photoUri = await persistCapturePhoto(id, phase.base64, phase.photoUri)

    const creature: Creature = {
      id,
      species: cleanName,
      commonName: cleanName,
      rarity: 'common',
      stats: { hp: 0, attack: 0, defense: 0, speed: 0 },
      note: '',
      photoUri,
      capturedAt: Date.now(),
    }

    await addToCollection(creature, privyUserId)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.replace('/collection')
  }, [name, phase, privyUserId, saving])

  if (phase.status === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
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
          <Text style={styles.stateTitle}>nothing to add</Text>
          <Text style={styles.stateBody}>that photo didn&apos;t come through.</Text>
          <View style={styles.stateAction}>
            <PrimaryButton label="back home" onPress={goHome} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const form = (
    <View style={styles.formContent}>
      <View style={styles.formHeader}>
        <MicroLabel color={theme.colors.textMuted}>new animal</MicroLabel>
        <Text style={styles.title}>Name this animal</Text>
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
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
            {liquid ? (
              <GlassContainer spacing={18} style={styles.heroGlassContainer}>
                <GlassView style={styles.photoGlass} glassEffectStyle="regular">
                  <Image source={{ uri: phase.photoUri }} style={styles.photo} />
                </GlassView>
              </GlassContainer>
            ) : (
              <View style={[styles.photoGlass, styles.fallbackCard]}>
                <Image source={{ uri: phase.photoUri }} style={styles.photo} />
              </View>
            )}
          </View>

          {liquid ? (
            <GlassContainer spacing={18} style={styles.stack}>
              <GlassView style={styles.formCard} glassEffectStyle="regular">
                {form}
              </GlassView>
              <GlassView style={styles.keepGlass} glassEffectStyle="regular" isInteractive>
                <KeepButton saving={saving} disabled={!name.trim()} onPress={onKeep} />
              </GlassView>
            </GlassContainer>
          ) : (
            <View style={styles.stack}>
              <View style={[styles.formCard, styles.fallbackCard]}>{form}</View>
              <View style={[styles.keepGlass, styles.fallbackCard]}>
                <KeepButton saving={saving} disabled={!name.trim()} onPress={onKeep} />
              </View>
            </View>
          )}

          <Pressable
            onPress={goHome}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Cancel and return home"
          >
            <Text style={styles.cancelText}>cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxl,
    gap: theme.space.md,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: theme.space.lg,
  },
  heroGlassContainer: {
    width: '100%',
  },
  photoGlass: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 34,
    overflow: 'hidden',
    padding: 5,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    backgroundColor: theme.colors.surfaceRaised,
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
  cancelButton: {
    alignSelf: 'center',
    marginTop: theme.space.lg,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.xl,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.72,
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
})
