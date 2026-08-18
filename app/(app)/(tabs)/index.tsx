import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { SpecimenCard } from '@/components/specimen-card'
import { theme } from '@/constants/theme'
import { loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { isMockCreaturesEnabled, mockCreatures } from '@/lib/dev-mock'
import {
  clampToBounds,
  homePositionFor,
  loadPlacements,
  savePlacement,
  type SanctuaryBounds,
  type SanctuaryPlacements,
  type SanctuaryPoint,
} from '@/lib/sanctuary'
import { usePlayer } from '@/lib/use-player'


function DraggableCompanion({
  creature,
  initialPos,
  onInspect,
  onMoved,
}: {
  creature: Creature
  initialPos: SanctuaryPoint
  onInspect: (creature: Creature) => void
  onMoved: (creature: Creature, point: SanctuaryPoint) => void
}) {
  const pan = useRef(new Animated.ValueXY(initialPos)).current
  const scale = useRef(new Animated.Value(1)).current
  const bounceAnim = useRef(new Animated.Value(0)).current

  const triggerPettingAnimation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Bounce physics
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: -18, duration: 110, useNativeDriver: false }),
      Animated.spring(bounceAnim, { toValue: 0, friction: 4, tension: 180, useNativeDriver: false }),
    ]).start()
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        })
        pan.setValue({ x: 0, y: 0 })
        Animated.spring(scale, {
          toValue: 1.18,
          friction: 6,
          useNativeDriver: false,
        }).start()
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (e, gestureState) => {
        pan.flattenOffset()
        // Remember where the player put it, so the sanctuary keeps its arrangement.
        onMoved(creature, {
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        })
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          useNativeDriver: false,
        }).start()

        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          triggerPettingAnimation()
          onInspect(creature)
        }
      },
    }),
  ).current

  const imageUri = creature.cutoutUri || creature.photoUri

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.draggableFrame,
        {
          transform: [
            { translateX: pan.x },
            { translateY: Animated.add(pan.y, bounceAnim) },
            { scale: scale },
          ],
        },
      ]}
    >
      <View style={styles.companionFrame}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={creature.cutoutUri ? styles.companionCutoutImg : styles.companionAvatarPhoto}
            contentFit={creature.cutoutUri ? 'contain' : 'cover'}
          />
        ) : (
          <Image
            source={require('@/assets/tab-icons-transparent/profile.png')}
            style={styles.companionMascotImg}
            contentFit="contain"
          />
        )}
      </View>
    </Animated.View>
  )
}

export default function HomeScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const [placements, setPlacements] = useState<SanctuaryPlacements>({})
  const [inspectedCreature, setInspectedCreature] = useState<Creature | null>(null)
  const { privyUserId } = usePlayer()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  // Anchored at 52% of the screen; this band keeps companions on the meadow
  // between the horizon and the scan button rather than up in the sky.
  const bounds: SanctuaryBounds = {
    halfWidth: Math.min(width / 2 - 48, 152),
    top: -10,
    bottom: 175,
    // Only the avatar's lower body is protected: half his width, plus a
    // companion's radius, plus margin. Companions near his head may overlap —
    // drawn behind him, that reads as distance rather than collision.
    reserved: { halfWidth: 88, top: 80, bottom: 175 },
  }

  useFocusEffect(
    useCallback(() => {
      let active = true
      void Promise.all([loadCollection(privyUserId), loadPlacements(privyUserId)]).then(([next, saved]) => {
        if (!active) return
        // Dev seeding is render-only — never persisted, never uploaded.
        setCreatures(isMockCreaturesEnabled ? [...next, ...mockCreatures()] : next)
        setPlacements(saved)
      })
      return () => {
        active = false
      }
    }, [privyUserId]),
  )

  const onCompanionMoved = (creature: Creature, point: SanctuaryPoint) => {
    setPlacements((prev) => ({ ...prev, [creature.id]: point }))
    void savePlacement(privyUserId, creature.id, point)
  }

  if (creatures === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    )
  }

  // Oldest-first arrival order: a new catch appends instead of reshuffling
  // everyone already living here.
  const arrivalOrder = new Map(
    [...creatures].sort((a, b) => a.capturedAt - b.capturedAt).map((creature, index) => [creature.id, index]),
  )

  // Painter's order: companions lower on the meadow draw in front, so any
  // overlap reads as depth instead of collision.
  const placed = creatures
    .map((creature) => ({
      creature,
      position: placements[creature.id]
        ? clampToBounds(placements[creature.id], bounds)
        : homePositionFor(creature.id, arrivalOrder.get(creature.id) ?? 0, bounds),
    }))
    .sort((a, b) => a.position.y - b.position.y)

  return (
    <View style={styles.container}>
      {/* Full-Screen Outdoor Sanctuary Background */}
      <Image
        source={require('@/assets/sanctuary.jpg')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />

      {/* Interactive Drag & Drop Sanctuary Habitat Area */}
      <View style={styles.habitatCompanionArea} pointerEvents="box-none">
        {placed.map(({ creature, position }) => (
          <DraggableCompanion
            key={creature.id}
            creature={creature}
            initialPos={position}
            onInspect={(c) => setInspectedCreature(c)}
            onMoved={onCompanionMoved}
          />
        ))}
      </View>

      {/* The player, standing in their own sanctuary. Drawn above the companions
          so any behind it read as distance; never intercepts touches, so a
          companion partly hidden by it is still draggable. */}
      <Image
        source={require('@/assets/onboarding-greeting.png')}
        style={[styles.playerAvatar, { bottom: insets.bottom + 238 }]}
        contentFit="contain"
        pointerEvents="none"
      />

      {/* Floating Bottom Overlays */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 115 }]} pointerEvents="box-none">
        {/* Primary scan CTA floating above the tabs */}
        <Pressable
          style={({ pressed }) => [styles.scanCircleBtn, pressed && styles.scanBtnPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/camera')
          }}
          accessibilityRole="button"
          accessibilityLabel="Scan an animal"
        >
          <Image
            source={require('@/assets/scan-lens.png')}
            style={styles.scanLensImg}
            contentFit="contain"
          />
        </Pressable>
      </View>

      {/* 2.5D Specimen Companion Inspection Modal */}
      <Modal
        visible={Boolean(inspectedCreature)}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectedCreature(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInspectedCreature(null)} />
          {inspectedCreature ? (
            <View style={[styles.inspectModalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={styles.inspectHeader}>
                <Text style={styles.inspectTitle}>Companion Specimen</Text>
                <Pressable
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                  onPress={() => setInspectedCreature(null)}
                >
                  <Ionicons name="close" size={20} color="#F5F2E9" />
                </Pressable>
              </View>

              <SpecimenCard creature={inspectedCreature} />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.viewfinder,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitatCompanionArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '52%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  draggableFrame: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionAvatarPhoto: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: '#B7F34A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  companionCutoutImg: {
    width: 80,
    height: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  companionMascotImg: {
    width: 76,
    height: 76,
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  scanCircleBtn: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  scanLensImg: {
    width: 72,
    height: 72,
  },
  playerAvatar: {
    position: 'absolute',
    alignSelf: 'center',
    width: 100,
    height: 150,
    zIndex: 12,
  },
  scanBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inspectModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#182019',
    borderRadius: 32,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(183, 243, 74, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  inspectHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  inspectTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#B7F34A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F1411',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 242, 233, 0.12)',
  },
  pressedOpacity: {
    opacity: 0.75,
  },
})








