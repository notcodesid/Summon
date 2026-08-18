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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { SpecimenCard } from '@/components/specimen-card'
import { loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { usePlayer } from '@/lib/use-player'

const DEFAULT_POSITIONS = [
  { x: 0, y: 40 },         // 1. Stone bridge center
  { x: -95, y: -30 },      // 2. Left meadow path
  { x: 95, y: -10 },       // 3. Right pasture near treehouse
  { x: 75, y: -140 },      // 4. Treehouse balcony
  { x: -110, y: -110 },    // 5. High pine forest top left
  { x: -40, y: -80 },      // 6. Central hill path
  { x: -100, y: 55 },       // 7. Lower stream bank left
  { x: 40, y: 20 },        // 8. River bank right
  { x: 110, y: -90 },      // 9. Treehouse foliage
  { x: -12, y: -165 },     // 10. Far upper mountain valley
]

function DraggableCompanion({
  creature,
  initialPos,
  onInspect,
}: {
  creature: Creature
  initialPos: { x: number; y: number }
  onInspect: (creature: Creature) => void
}) {
  const pan = useRef(new Animated.ValueXY(initialPos)).current
  const scale = useRef(new Animated.Value(1)).current
  const bounceAnim = useRef(new Animated.Value(0)).current
  const heartTranslateY = useRef(new Animated.Value(0)).current
  const heartOpacity = useRef(new Animated.Value(0)).current
  const [heartKey, setHeartKey] = useState(0)

  const triggerPettingAnimation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setHeartKey((prev) => prev + 1)
    heartTranslateY.setValue(0)
    heartOpacity.setValue(1)

    // Bounce physics
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: -18, duration: 110, useNativeDriver: false }),
      Animated.spring(bounceAnim, { toValue: 0, friction: 4, tension: 180, useNativeDriver: false }),
    ]).start()

    // Floating hearts animation
    Animated.parallel([
      Animated.timing(heartTranslateY, { toValue: -50, duration: 800, useNativeDriver: false }),
      Animated.timing(heartOpacity, { toValue: 0, duration: 800, useNativeDriver: false }),
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
      {/* Floating Heart Particles Animation */}
      <Animated.View
        key={heartKey}
        style={[
          styles.floatingHeartContainer,
          {
            opacity: heartOpacity,
            transform: [{ translateY: heartTranslateY }],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.floatingHeartText}>❤️</Text>
      </Animated.View>

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
  const [inspectedCreature, setInspectedCreature] = useState<Creature | null>(null)
  const { privyUserId } = usePlayer()
  const insets = useSafeAreaInsets()

  useFocusEffect(
    useCallback(() => {
      let active = true
      void loadCollection(privyUserId).then((next) => {
        if (active) setCreatures(next)
      })
      return () => {
        active = false
      }
    }, [privyUserId]),
  )

  if (creatures === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    )
  }

  const activeCompanions = creatures.slice(0, 10)

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
        {activeCompanions.map((creature, idx) => (
          <DraggableCompanion
            key={creature.id}
            creature={creature}
            initialPos={DEFAULT_POSITIONS[idx % DEFAULT_POSITIONS.length]}
            onInspect={(c) => setInspectedCreature(c)}
          />
        ))}
      </View>

      {/* Floating Bottom Overlays */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 115 }]} pointerEvents="box-none">
        {/* Primary Pokéball Scan Camera CTA floating above tabs */}
        <Pressable
          style={({ pressed }) => [styles.scanCircleBtn, pressed && styles.scanBtnPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/camera')
          }}
          accessibilityRole="button"
          accessibilityLabel="Open Scan Camera"
        >
          <Image
            source={require('@/assets/pokeball_btn.jpg')}
            style={styles.pokeballImg}
            contentFit="cover"
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
    backgroundColor: '#0F172A',
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
  floatingHeartContainer: {
    position: 'absolute',
    top: -30,
    alignSelf: 'center',
    zIndex: 30,
  },
  floatingHeartText: {
    fontSize: 22,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
    overflow: 'hidden',
  },
  pokeballImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    transform: [{ scale: 1.38 }],
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








