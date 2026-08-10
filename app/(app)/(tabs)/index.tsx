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
  isSelected,
  onSelect,
}: {
  creature: Creature
  initialPos: { x: number; y: number }
  isSelected: boolean
  onSelect: () => void
}) {
  const pan = useRef(new Animated.ValueXY(initialPos)).current
  const scale = useRef(new Animated.Value(1)).current

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
          toValue: 1.16,
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onSelect()
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
            { translateY: pan.y },
            { scale: scale },
          ],
        },
      ]}
    >
      {isSelected ? (
        <View style={styles.companionBubbleCard}>
          <View style={styles.bubbleHeader}>
            <Text style={styles.bubbleName}>
              {creature.commonName || creature.species}
            </Text>
            <Text style={styles.bubbleRarity}>
              {creature.rarity.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.bubbleSpecies}>{creature.species}</Text>
          {creature.stats ? (
            <View style={styles.bubbleStatsRow}>
              <Text style={styles.bubbleStatText}>⚡ {creature.stats.attack} ATK</Text>
              <Text style={styles.bubbleStatText}>🛡️ {creature.stats.defense} DEF</Text>
            </View>
          ) : null}
        </View>
      ) : null}

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
        <View style={styles.activePulseIndicator} />
      </View>
    </Animated.View>
  )
}

export default function HomeScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
              isSelected={selectedId === creature.id}
              onSelect={() =>
                setSelectedId((prev) => (prev === creature.id ? null : creature.id))
              }
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
            isSelected={selectedId === 'mascot-lee'}
            onSelect={() =>
              setSelectedId((prev) => (prev === 'mascot-lee' ? null : 'mascot-lee'))
            }
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
  companionBubbleCard: {
    position: 'absolute',
    bottom: 85,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    minWidth: 160,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bubbleName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E3B33',
  },
  bubbleRarity: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2B6F93',
    backgroundColor: '#DDEFF8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bubbleSpecies: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#5C7A70',
    marginTop: 2,
  },
  bubbleStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  bubbleStatText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2F7D5B',
    backgroundColor: '#EAEFEA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
  activePulseIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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







