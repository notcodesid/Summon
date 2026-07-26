import { useEffect } from 'react'
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '@/constants/theme'
import { RARITY_COLOR } from '@/lib/creatures'
import { animalImageAt } from '@/lib/animal-images'

/**
 * The sign-in hero.
 *
 * Everything is emitted from the scan logo at the bottom: each specimen starts
 * at the logo's centre, then travels out and up into a V that widens toward
 * the top of the screen, growing as it goes. The cycle repeats forever and
 * each orb is offset in phase, so the fan is continuously fed from the logo.
 *
 * Orbs show a real animal photo when one is listed in `lib/animal-images.ts`,
 * and fall back to an icon otherwise.
 */
type Tone = 'ink' | 'muted' | 'pale' | 'rare' | 'epic' | 'legendary'

type Orb = {
  size: number
  /** Resting position: fraction of container width, and px from the top. */
  left: number
  top: number
  icon: keyof typeof Ionicons.glyphMap
  tone: Tone
}

const TONES: Record<Tone, { bg: string; fg: string }> = {
  ink: { bg: theme.colors.text, fg: theme.colors.onDark },
  muted: { bg: theme.colors.textMuted, fg: theme.colors.onDark },
  pale: { bg: theme.colors.surfaceRaised, fg: theme.colors.textMuted },
  rare: { bg: RARITY_COLOR.rare, fg: '#FFFFFF' },
  epic: { bg: RARITY_COLOR.epic, fg: '#FFFFFF' },
  legendary: { bg: RARITY_COLOR.legendary, fg: '#FFFFFF' },
}

/**
 * Ordered nearest-the-logo first so the V is fed from the inside out. Rows
 * widen as they rise, which is what makes the fan read as a V.
 */
const ORBS: Orb[] = [
  // innermost pair, just above the logo
  { size: 58, left: 0.24, top: 150, icon: 'sparkles', tone: 'legendary' },
  { size: 46, left: 0.55, top: 158, icon: 'snow', tone: 'pale' },
  // middle band
  { size: 72, left: 0.34, top: 66, icon: 'footsteps', tone: 'epic' },
  { size: 50, left: 0.66, top: 84, icon: 'egg', tone: 'pale' },
  { size: 56, left: 0.08, top: 76, icon: 'moon', tone: 'muted' },
  // outer band, widest
  { size: 44, left: 0.45, top: 14, icon: 'bug', tone: 'muted' },
  { size: 60, left: 0.61, top: 2, icon: 'fish', tone: 'rare' },
  { size: 66, left: 0.19, top: 0, icon: 'paw', tone: 'ink' },
  { size: 48, left: 0.84, top: 18, icon: 'flower', tone: 'pale' },
  { size: 52, left: 0.00, top: 6, icon: 'leaf', tone: 'pale' },
]

const CLUSTER_HEIGHT = 300
const ANCHOR_SIZE = 74
const ANCHOR_LEFT = 0.38
const ANCHOR_TOP = 216

/** One full emit-travel-fade pass, per orb. */
const CYCLE_MS = 5200
/** Phase offset between orbs; shorter than the cycle so the stream overlaps. */
const EMIT_GAP = 430
const ANCHOR_DELAY = 120

function SpecimenOrb({
  orb,
  index,
  containerWidth,
}: {
  orb: Orb
  index: number
  containerWidth: number
}) {
  const cycle = useSharedValue(0)
  const tone = TONES[orb.tone]
  const photo = animalImageAt(index)

  // Offset from this orb's centre to the logo's centre — the orb is born there.
  const restX = orb.left * containerWidth
  const anchorCentreX = ANCHOR_LEFT * containerWidth + ANCHOR_SIZE / 2
  const anchorCentreY = ANCHOR_TOP + ANCHOR_SIZE / 2
  const dx = anchorCentreX - (restX + orb.size / 2)
  const dy = anchorCentreY - (orb.top + orb.size / 2)

  useEffect(() => {
    cycle.value = withDelay(
      index * EMIT_GAP,
      withRepeat(
        withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
        -1,
        false,
      ),
    )
  }, [cycle, index])

  const animatedStyle = useAnimatedStyle(() => {
    const p = cycle.value

    // Travel occupies the first ~62% of the cycle, then it holds and fades.
    const t = interpolate(p, [0, 0.62], [0, 1], Extrapolation.CLAMP)
    const eased = 1 - Math.pow(1 - t, 3)

    return {
      opacity: interpolate(
        p,
        [0, 0.1, 0.8, 0.97],
        [0, 1, 1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        { translateX: (1 - eased) * dx },
        { translateY: (1 - eased) * dy },
        { scale: 0.12 + eased * 0.88 },
      ],
    }
  })

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: orb.size,
          height: orb.size,
          borderRadius: orb.size / 2,
          backgroundColor: photo ? theme.colors.surfaceRaised : tone.bg,
          left: restX,
          top: orb.top,
        },
        animatedStyle,
      ]}
    >
      {photo ? (
        <Image
          source={photo}
          style={[
            styles.photo,
            { width: orb.size, height: orb.size, borderRadius: orb.size / 2 },
          ]}
          resizeMode="cover"
        />
      ) : (
        <Ionicons name={orb.icon} size={orb.size * 0.42} color={tone.fg} />
      )}
    </Animated.View>
  )
}

/** The logo everything is emitted from. Lands first, then stays put. */
function AnchorOrb({ containerWidth }: { containerWidth: number }) {
  const enter = useSharedValue(0)
  const pulse = useSharedValue(0)

  useEffect(() => {
    enter.value = withDelay(
      ANCHOR_DELAY,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    )
    // A slow breath, timed to the emission so the logo feels like the source.
    pulse.value = withDelay(
      ANCHOR_DELAY + 400,
      withRepeat(
        withTiming(1, {
          duration: EMIT_GAP * 2,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    )
  }, [enter, pulse])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.7 + enter.value * 0.3 + pulse.value * 0.035 }],
  }))

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: ANCHOR_SIZE,
          height: ANCHOR_SIZE,
          borderRadius: ANCHOR_SIZE / 2,
          backgroundColor: theme.colors.text,
          left: ANCHOR_LEFT * containerWidth,
          top: ANCHOR_TOP,
        },
        animatedStyle,
      ]}
    >
      <Ionicons
        name="scan"
        size={ANCHOR_SIZE * 0.42}
        color={theme.colors.onDark}
      />
    </Animated.View>
  )
}

export function SpecimenOrbs() {
  const { width } = useWindowDimensions()
  const containerWidth = width - theme.space.xl * 2

  return (
    <View style={styles.cluster} pointerEvents="none">
      {ORBS.map((orb, index) => (
        <SpecimenOrb
          key={orb.icon}
          orb={orb}
          index={index}
          containerWidth={containerWidth}
        />
      ))}
      {/* Drawn last so specimens emerge from behind the logo. */}
      <AnchorOrb containerWidth={containerWidth} />
    </View>
  )
}

const styles = StyleSheet.create({
  cluster: {
    height: CLUSTER_HEIGHT,
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  orb: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    resizeMode: 'cover',
  },
})
