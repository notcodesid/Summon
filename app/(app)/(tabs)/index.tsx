import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
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
import { theme } from '@/constants/theme'
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
}: {
  creature: Creature
  initialPos: { x: number; y: number }
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
        }
      },
    }),
  ).current

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
        {creature.photoUri ? (
          <Image source={{ uri: creature.photoUri }} style={styles.companionAvatarPhoto} contentFit="cover" />
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
        contentFit="fill"
      />

      {/* Interactive Drag & Drop Sanctuary Habitat Area */}
      <View style={styles.habitatCompanionArea} pointerEvents="box-none">
        {activeCompanions.length > 0 ? (
          activeCompanions.map((creature, idx) => (
            <DraggableCompanion
              key={creature.id}
              creature={creature}
              initialPos={DEFAULT_POSITIONS[idx % DEFAULT_POSITIONS.length]}
            />
          ))
        ) : (
          <DraggableCompanion
            creature={{
              id: 'mascot-lee',
              species: 'Sanctuary Mascot',
              commonName: 'Lee • Field Guide',
              rarity: 'common',
              stats: { hp: 100, attack: 50, defense: 50, speed: 50 },
              note: 'Ready for field scanning!',
              photoUri: '',
              capturedAt: Date.now(),
            }}
            initialPos={{ x: 0, y: 30 }}
          />
        )}
      </View>

      {/* Floating Bottom Overlays */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 115 }]} pointerEvents="box-none">
        {/* Primary Scan Camera Circular CTA floating above tabs */}
        <Pressable
          style={({ pressed }) => [styles.scanCircleBtn, pressed && styles.scanBtnPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/camera')
          }}
        >
          <Ionicons name="camera" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#61B6A9',
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
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2F7D5B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  scanBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.95 }],
  },
})







