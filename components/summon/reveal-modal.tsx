import { useEffect } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { AppIcon } from '@/components/summon/app-icon'
import { CollectibleMark } from '@/components/summon/collectible-mark'
import { theme } from '@/constants/theme'
import { Collectible, PullRecord } from '@/features/summon/types'

export function RevealModal({
  visible,
  item,
  pull,
  onClose,
}: {
  visible: boolean
  item: Collectible | null | undefined
  pull: PullRecord | null
  onClose: () => void
}) {
  const scale = useSharedValue(0.6)
  const opacity = useSharedValue(0)
  const badgeY = useSharedValue(16)

  useEffect(() => {
    if (!visible) {
      scale.value = 0.6
      opacity.value = 0
      badgeY.value = 16
      return
    }
    opacity.value = withTiming(1, { duration: 220 })
    scale.value = withSequence(
      withTiming(1.08, { duration: 420, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 12, stiffness: 140 }),
    )
    badgeY.value = withDelay(280, withSpring(0, { damping: 14 }))
  }, [visible, scale, opacity, badgeY])

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  const metaStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: badgeY.value }],
  }))

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modal}>
        <Animated.Text style={[styles.overline, metaStyle]}>YOU SUMMONED</Animated.Text>
        <Animated.View style={orbStyle}>
          {item ? <CollectibleMark mark={item.symbol} accent={item.accent} size={108} /> : null}
        </Animated.View>
        <Animated.View style={[styles.meta, metaStyle]}>
          <Text style={styles.rarity}>{item?.rarity}</Text>
          <Text style={styles.name}>{item?.name}</Text>
          <Text style={styles.lore}>{item?.lore}</Text>
          <View style={styles.verified}>
            <AppIcon name="checkmark.seal.fill" size={14} color={theme.colors.text} />
            <Text style={styles.verifiedText}>
              Roll {pull?.roll.toLocaleString()} · {pull?.status === 'verified' ? 'Verified' : 'Demo'}
            </Text>
          </View>
        </Animated.View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.continueButton}>
          <Text style={styles.continueText}>Add to collection</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(252,252,251,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 14,
  },
  overline: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  meta: { alignItems: 'center', gap: 8, width: '100%' },
  rarity: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  lore: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  verifiedText: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  continueButton: {
    marginTop: 16,
    minHeight: 54,
    width: '100%',
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
})
