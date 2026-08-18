import { useCallback, useEffect } from 'react'
import {
  Dimensions,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import {
  RARITY_COLOR,
  RARITY_LABEL,
  powerOf,
  type Creature,
  type Rarity,
} from '@/lib/creatures'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 360)
const CARD_HEIGHT = CARD_WIDTH * 1.38

export type SpecimenCardProps = {
  creature: Pick<Creature, 'species' | 'commonName' | 'rarity' | 'stats' | 'note'> & {
    photoUri: string
    cutoutUri?: string
  }
  interactive?: boolean
  showStats?: boolean
  showDetails?: boolean
  cardWidth?: number
  onPress?: () => void
}

const FOIL_TINTS: Record<Rarity, { primary: string; secondary: string; shimmer: string }> = {
  common: {
    primary: 'rgba(255, 255, 255, 0.08)',
    secondary: 'rgba(200, 205, 200, 0.15)',
    shimmer: 'rgba(255, 255, 255, 0.35)',
  },
  uncommon: {
    primary: 'rgba(79, 122, 82, 0.25)',
    secondary: 'rgba(183, 243, 74, 0.22)',
    shimmer: 'rgba(183, 243, 74, 0.45)',
  },
  rare: {
    primary: 'rgba(59, 108, 168, 0.30)',
    secondary: 'rgba(120, 190, 255, 0.25)',
    shimmer: 'rgba(180, 225, 255, 0.55)',
  },
  epic: {
    primary: 'rgba(122, 79, 168, 0.32)',
    secondary: 'rgba(220, 140, 255, 0.28)',
    shimmer: 'rgba(240, 190, 255, 0.60)',
  },
  legendary: {
    primary: 'rgba(176, 122, 43, 0.35)',
    secondary: 'rgba(255, 215, 0, 0.32)',
    shimmer: 'rgba(255, 240, 160, 0.75)',
  },
}

export function SpecimenCard({
  creature,
  interactive = true,
  /** Combat numbers. Off until battle ships — see PLAN.md. */
  showStats = false,
  showDetails = true,
  cardWidth = CARD_WIDTH,
  onPress,
}: SpecimenCardProps) {
  const cardHeight = cardWidth * 1.38
  const rarity = creature.rarity || 'common'
  const rarityColor = RARITY_COLOR[rarity]
  const foil = FOIL_TINTS[rarity]
  const totalPower = powerOf(creature.stats)

  const rotX = useSharedValue(0)
  const rotY = useSharedValue(0)
  const scale = useSharedValue(1)
  const popZ = useSharedValue(0)
  const idleTilt = useSharedValue(0)
  const isInteracting = useSharedValue(false)

  // Idle floating tilt animation
  useEffect(() => {
    idleTilt.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    )
  }, [idleTilt])

  const triggerLightHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [])

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => interactive,
    onMoveShouldSetPanResponder: () => interactive,
    onPanResponderGrant: () => {
      isInteracting.value = true
      scale.value = withSpring(1.05, { damping: 14, stiffness: 220 })
      popZ.value = withSpring(1, { damping: 12, stiffness: 180 })
      triggerLightHaptic()
    },
    onPanResponderMove: (_, gestureState) => {
      const maxAngle = 18 // max tilt degrees
      const normalizedX = Math.min(Math.max(gestureState.dx / (cardWidth * 0.5), -1.2), 1.2)
      const normalizedY = Math.min(Math.max(gestureState.dy / (cardHeight * 0.5), -1.2), 1.2)

      rotY.value = normalizedX * maxAngle
      rotX.value = -normalizedY * maxAngle
    },
    onPanResponderRelease: () => {
      isInteracting.value = false
      rotX.value = withSpring(0, { damping: 15, stiffness: 160 })
      rotY.value = withSpring(0, { damping: 15, stiffness: 160 })
      scale.value = withSpring(1, { damping: 15, stiffness: 160 })
      popZ.value = withSpring(0, { damping: 14, stiffness: 150 })
      if (onPress) onPress()
    },
  })

  // 3D Card Chassis Transform
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const activeRotX = isInteracting.value ? rotX.value : rotX.value + idleTilt.value * 2.5
    const activeRotY = isInteracting.value ? rotY.value : rotY.value + idleTilt.value * -3

    return {
      transform: [
        { perspective: 1100 },
        { scale: scale.value },
        { rotateX: `${activeRotX}deg` },
        { rotateY: `${activeRotY}deg` },
      ],
    }
  })

  // Holographic Sheen / Foil Layer Transform
  const sheenAnimatedStyle = useAnimatedStyle(() => {
    const activeRotX = isInteracting.value ? rotX.value : rotX.value + idleTilt.value * 2.5
    const activeRotY = isInteracting.value ? rotY.value : rotY.value + idleTilt.value * -3

    const transX = interpolate(activeRotY, [-18, 18], [-cardWidth * 0.8, cardWidth * 0.8])
    const transY = interpolate(activeRotX, [-18, 18], [cardHeight * 0.8, -cardHeight * 0.8])
    const opacity = interpolate(
      Math.abs(activeRotX) + Math.abs(activeRotY),
      [0, 6, 24],
      [0.2, 0.45, 0.85],
    )

    return {
      opacity,
      transform: [
        { translateX: transX },
        { translateY: transY },
        { rotate: '35deg' },
      ],
    }
  })

  // 2.5D Creature Pop-out Layer Transform (pops higher in Z space than the card plate)
  const specimenPopStyle = useAnimatedStyle(() => {
    const popScale = interpolate(popZ.value, [0, 1], [1, 1.14])
    const shiftX = interpolate(rotY.value, [-18, 18], [-12, 12])
    const shiftY = interpolate(rotX.value, [-18, 18], [12, -12])

    return {
      transform: [
        { scale: popScale },
        { translateX: shiftX },
        { translateY: shiftY },
      ],
    }
  })

  // Floating Stat Chips Parallax Offset
  const statsParallaxStyle = useAnimatedStyle(() => {
    const shiftX = interpolate(rotY.value, [-18, 18], [-6, 6])
    const shiftY = interpolate(rotX.value, [-18, 18], [6, -6])

    return {
      transform: [
        { translateX: shiftX },
        { translateY: shiftY },
      ],
    }
  })

  const imageSource = creature.cutoutUri
    ? { uri: creature.cutoutUri }
    : creature.photoUri
      ? { uri: creature.photoUri }
      : null

  return (
    <View style={styles.outerContainer} {...(interactive ? panResponder.panHandlers : {})}>
      <Animated.View
        style={[
          styles.cardChassis,
          {
            width: cardWidth,
            height: cardHeight,
            borderColor: `${rarityColor}55`,
            shadowColor: rarityColor,
          },
          cardAnimatedStyle,
        ]}
      >
        {/* Background Ambient Rarity Glow Plate */}
        <View style={[styles.ambientGlow, { backgroundColor: `${rarityColor}18` }]} />

        {/* Top Header Row: Rarity Badge + Power Rating */}
        <View style={styles.cardHeaderRow}>
          <View style={[styles.rarityBadge, { backgroundColor: `${rarityColor}28`, borderColor: rarityColor }]}>
            <Text style={[styles.rarityText, { color: rarityColor }]}>{RARITY_LABEL[rarity]}</Text>
          </View>

          {showStats ? (
            <View style={styles.powerPill}>
              <Text style={styles.powerLabel}>CP</Text>
              <Text style={styles.powerValue}>{totalPower}</Text>
            </View>
          ) : null}
        </View>

        {/* 2.5D Creature Specimen Stage */}
        <View style={styles.specimenStage}>
          {/* Circular Habitat Aura */}
          <View style={[styles.specimenAura, { borderColor: `${rarityColor}40` }]} />

          {/* Pop-Out Creature Image Layer */}
          <Animated.View style={[styles.specimenImageWrapper, specimenPopStyle]}>
            {imageSource ? (
              <Image
                source={imageSource}
                style={creature.cutoutUri ? styles.specimenCutoutImage : styles.specimenPhotoImage}
                resizeMode={creature.cutoutUri ? 'contain' : 'cover'}
              />
            ) : (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderEmoji}>🐾</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Dynamic Holographic Foil & Prism Sheen Overlay */}
        <View style={styles.sheenMask} pointerEvents="none">
          <Animated.View
            style={[
              styles.foilBeam,
              {
                backgroundColor: foil.shimmer,
                shadowColor: foil.secondary,
              },
              sheenAnimatedStyle,
            ]}
          />
        </View>

        {/* Bottom Specimen Details & Stats Plate */}
        {showDetails ? (
          <Animated.View style={[styles.detailsPlate, statsParallaxStyle]}>
            <View style={styles.titleColumn}>
              <Text style={styles.commonName} numberOfLines={1}>
                {creature.commonName || creature.species}
              </Text>
              {creature.species ? (
                <Text style={styles.speciesName} numberOfLines={1}>
                  {creature.species}
                </Text>
              ) : null}
            </View>

            {creature.note ? (
              <Text style={styles.noteText} numberOfLines={2}>
                &ldquo;{creature.note}&rdquo;
              </Text>
            ) : null}

            {/* RPG Stat Chips */}
            {showStats && creature.stats ? (
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>HP</Text>
                  <Text style={styles.statValue}>{creature.stats.hp}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>ATK</Text>
                  <Text style={styles.statValue}>{creature.stats.attack}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>DEF</Text>
                  <Text style={styles.statValue}>{creature.stats.defense}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>SPD</Text>
                  <Text style={styles.statValue}>{creature.stats.speed}</Text>
                </View>
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Card Frame Aesthetic Reticle Corners */}
        <View style={[styles.reticleCorner, styles.cornerTL, { borderColor: `${rarityColor}80` }]} />
        <View style={[styles.reticleCorner, styles.cornerTR, { borderColor: `${rarityColor}80` }]} />
        <View style={[styles.reticleCorner, styles.cornerBL, { borderColor: `${rarityColor}80` }]} />
        <View style={[styles.reticleCorner, styles.cornerBR, { borderColor: `${rarityColor}80` }]} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cardChassis: {
    borderRadius: 28,
    backgroundColor: 'rgba(18, 24, 20, 0.94)',
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  ambientGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  rarityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  powerPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  powerLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B7F34A',
    letterSpacing: 0.6,
  },
  powerValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F5F2E9',
  },
  specimenStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    position: 'relative',
    minHeight: 160,
  },
  specimenAura: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    zIndex: 2,
  },
  specimenImageWrapper: {
    width: '90%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  specimenCutoutImage: {
    width: '100%',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  specimenPhotoImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  placeholderBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
  },
  sheenMask: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 8,
  },
  foilBeam: {
    position: 'absolute',
    top: -CARD_HEIGHT * 0.5,
    left: -CARD_WIDTH * 0.5,
    width: CARD_WIDTH * 2,
    height: 70,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  detailsPlate: {
    backgroundColor: 'rgba(15, 20, 17, 0.85)',
    borderRadius: 18,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 242, 233, 0.1)',
    zIndex: 10,
  },
  titleColumn: {
    gap: 2,
  },
  commonName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F5F2E9',
    letterSpacing: -0.4,
  },
  speciesName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA69D',
    fontStyle: 'italic',
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#C3C9C4',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 242, 233, 0.08)',
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B7F34A',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F5F2E9',
  },
  reticleCorner: {
    position: 'absolute',
    width: 14,
    height: 14,
    zIndex: 12,
  },
  cornerTL: {
    top: 8,
    left: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 8,
    right: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 4,
  },
})
