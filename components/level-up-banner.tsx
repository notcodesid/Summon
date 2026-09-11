import { useEffect, useRef } from 'react'
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { theme } from '@/constants/theme'
import { playSound } from '@/lib/audio'
import type { ExplorerProgress, ExplorerUnlock } from '@/lib/progression'

/**
 * The moment levelling up is worth something: it names the new level, shows
 * the progress that earned it, and — when the level crossed an unlock —
 * announces what changed in the sanctuary.
 */
export function LevelUpBanner({
  visible,
  progress,
  unlocks,
  onDismiss,
  reduceMotion = false,
}: {
  visible: boolean
  progress: ExplorerProgress
  unlocks: ExplorerUnlock[]
  onDismiss: () => void
  reduceMotion?: boolean
}) {
  const scrim = useRef(new Animated.Value(0)).current
  const card = useRef(new Animated.Value(0)).current
  const glow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    playSound('level-up')

    if (reduceMotion) {
      scrim.setValue(1)
      card.setValue(1)
      glow.setValue(1)
    } else {
      scrim.setValue(0)
      card.setValue(0)
      glow.setValue(0)
      Animated.timing(scrim, { toValue: 1, duration: 220, useNativeDriver: true }).start()
      Animated.spring(card, { toValue: 1, damping: 14, stiffness: 140, mass: 0.9, useNativeDriver: true }).start()
      Animated.timing(glow, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()
    }

    const timer = setTimeout(onDismiss, unlocks.length > 0 ? 6000 : 4500)
    return () => clearTimeout(timer)
  }, [visible, reduceMotion, scrim, card, glow, onDismiss, unlocks.length])

  if (!visible) return null

  const cardScale = card.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] })
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] })

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable
        style={styles.container}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={`Level ${progress.level}. Tap to continue`}
      >
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.scrim, { opacity: scrim }]} />

        <Animated.View style={[styles.card, { opacity: card, transform: [{ scale: cardScale }] }]}>
          <Animated.View style={[styles.glow, { opacity: glowOpacity }]} pointerEvents="none" />

          <Text style={styles.eyebrow}>EXPLORER LEVEL</Text>
          <Text style={styles.level}>{progress.level}</Text>

          <View style={styles.xpRow}>
            <Text style={styles.xpText}>{progress.totalXp.toLocaleString()} XP</Text>
            <Text style={styles.xpNext}>
              {progress.xpToNextLevel} to level {progress.level + 1}
            </Text>
          </View>

          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, progress.progress)) * 100)}%` }]}
            />
          </View>

          {unlocks.length > 0 ? (
            <View style={styles.unlockBlock}>
              {unlocks.map((unlock) => (
                <View key={unlock.key} style={styles.unlockRow}>
                  <View style={styles.unlockIcon}>
                    <Ionicons name={unlock.icon as keyof typeof Ionicons.glyphMap} size={19} color="#171A17" />
                  </View>
                  <View style={styles.unlockCopy}>
                    <Text style={styles.unlockLabel}>UNLOCKED · SANCTUARY</Text>
                    <Text style={styles.unlockName}>{unlock.label}</Text>
                    <Text style={styles.unlockDetail}>{unlock.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.dismiss}>tap to continue</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  scrim: { backgroundColor: 'rgba(15, 20, 17, 0.78)' },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: theme.radius.card,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#182019',
    borderWidth: 1,
    borderColor: 'rgba(183, 243, 74, 0.32)',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: theme.colors.primary,
  },
  eyebrow: { ...theme.type.micro, color: theme.colors.primary, marginBottom: 4 },
  level: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -3,
    color: '#F5F2E9',
    lineHeight: 78,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 2,
  },
  xpText: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  xpNext: { fontSize: 12, color: '#9CA69D' },
  track: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 242, 233, 0.14)',
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: theme.colors.primary },
  unlockBlock: {
    width: '100%',
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 242, 233, 0.12)',
    gap: 14,
  },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unlockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  unlockCopy: { flex: 1 },
  unlockLabel: { ...theme.type.micro, color: theme.colors.earth, fontSize: 10 },
  unlockName: { fontSize: 16, fontWeight: '800', color: '#F5F2E9', letterSpacing: -0.2, marginTop: 1 },
  unlockDetail: { fontSize: 12, color: '#9CA69D', marginTop: 2 },
  dismiss: { ...theme.type.micro, color: '#68736A', marginTop: 22, fontSize: 10 },
})
