import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { theme } from '@/constants/theme'
import { loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import {
  latestDiscovery,
  nextSpeciesMilestone,
  uniqueSpeciesCount,
  weeklyDiscoveryPrompt,
} from '@/lib/discovery-library'
import { usePlayer } from '@/lib/use-player'

export default function HomeScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const [completedGoals, setCompletedGoals] = useState<Record<string, boolean>>({
    water: false,
    explore: false,
    scan: false,
  })
  const { privyUserId } = usePlayer()
  const insets = useSafeAreaInsets()
  const weeklyPrompt = useMemo(() => weeklyDiscoveryPrompt(), [])

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
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      </SafeAreaView>
    )
  }

  const speciesCount = uniqueSpeciesCount(creatures)
  const milestone = nextSpeciesMilestone(creatures)
  const milestonePercent = Math.min(100, Math.round((milestone.current / Math.max(1, milestone.target)) * 100))

  const toggleGoal = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setCompletedGoals((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerIconBtn} hitSlop={12}>
            <Ionicons name="menu-outline" size={26} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable style={styles.headerIconBtn} hitSlop={12}>
              <Ionicons name="sparkles" size={22} color="#FFFFFF" />
              <View style={styles.headerBadge} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Sanctuary Habitat Scene Header */}
        <View style={styles.habitatContainer}>
          <ImageBackground
            source={require('@/assets/sanctuary.jpg')}
            style={styles.habitatBg}
            imageStyle={styles.habitatImageStyle}
          >
            {/* Cute Chick Companion "Lee" standing in sanctuary */}
            <View style={styles.mascotContainer}>
              <Image
                source={require('@/assets/tab-icons-transparent/profile.png')}
                style={styles.mascotImage}
                contentFit="contain"
              />
            </View>
          </ImageBackground>
        </View>

        {/* Adventure Progress Banner */}
        <View style={styles.adventureBanner}>
          <View style={styles.adventureHeader}>
            <View style={styles.boltBadge}>
              <Ionicons name="flash" size={18} color="#FFD13B" />
            </View>
            <Text style={styles.adventureTitle}>
              Species Expedition • {speciesCount} found
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${milestonePercent}%` }]} />
            <Text style={styles.progressText}>
              {milestone.current} / {milestone.target}
            </Text>
          </View>
        </View>

        {/* Goals Section */}
        <View style={styles.goalsSection}>
          <View style={styles.goalsHeader}>
            <View style={styles.goalsTitleRow}>
              <Ionicons name="calendar" size={20} color="#FFFFFF" />
              <Text style={styles.goalsTitle}>Field Goals Today</Text>
            </View>
            <View style={styles.goalsActions}>
              <Pressable style={styles.actionIconBtn} hitSlop={8}>
                <Ionicons name="options-outline" size={18} color="#FFFFFF" />
              </Pressable>
              <Pressable style={styles.actionIconBtn} hitSlop={8}>
                <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Goal 1: Scan an animal */}
          <Pressable
            style={[styles.goalCard, completedGoals.scan && styles.goalCardCompleted]}
            onPress={() => router.push('/camera')}
          >
            <View style={styles.goalStickerFrame}>
              <Image
                source={require('@/assets/tab-icons-transparent/home.png')}
                style={styles.goalSticker}
                contentFit="contain"
              />
            </View>
            <View style={styles.goalTextContainer}>
              <Text style={[styles.goalName, completedGoals.scan && styles.goalTextDone]}>
                Scan an animal outside
              </Text>
              <Text style={styles.goalCategory}>Weekly Mission • 10 ⚡</Text>
            </View>
            <Pressable
              style={[styles.checkBtn, completedGoals.scan && styles.checkBtnDone]}
              onPress={() => toggleGoal('scan')}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={completedGoals.scan ? '#FFFFFF' : '#8CA39B'}
              />
            </Pressable>
          </Pressable>

          {/* Goal 2: Hydrate */}
          <Pressable
            style={[styles.goalCard, completedGoals.water && styles.goalCardCompleted]}
            onPress={() => toggleGoal('water')}
          >
            <View style={styles.goalStickerFrame}>
              <Image
                source={require('@/assets/goal-icons/water.png')}
                style={styles.goalSticker}
                contentFit="contain"
              />
            </View>
            <View style={styles.goalTextContainer}>
              <Text style={[styles.goalName, completedGoals.water && styles.goalTextDone]}>
                Drink water
              </Text>
              <Text style={styles.goalCategory}>Health & Energy • 5 ⚡</Text>
            </View>
            <View style={[styles.checkBtn, completedGoals.water && styles.checkBtnDone]}>
              <Ionicons
                name="checkmark"
                size={18}
                color={completedGoals.water ? '#FFFFFF' : '#8CA39B'}
              />
            </View>
          </Pressable>

          {/* Goal 3: Explore */}
          <Pressable
            style={[styles.goalCard, completedGoals.explore && styles.goalCardCompleted]}
            onPress={() => toggleGoal('explore')}
          >
            <View style={styles.goalStickerFrame}>
              <Image
                source={require('@/assets/goal-icons/sunflower.png')}
                style={styles.goalSticker}
                contentFit="contain"
              />
            </View>
            <View style={styles.goalTextContainer}>
              <Text style={[styles.goalName, completedGoals.explore && styles.goalTextDone]}>
                {weeklyPrompt}
              </Text>
              <Text style={styles.goalCategory}>Exploration • 5 ⚡</Text>
            </View>
            <View style={[styles.checkBtn, completedGoals.explore && styles.checkBtnDone]}>
              <Ionicons
                name="checkmark"
                size={18}
                color={completedGoals.explore ? '#FFFFFF' : '#8CA39B'}
              />
            </View>
          </Pressable>
        </View>

        {/* Primary Scan Button */}
        <Pressable
          style={({ pressed }) => [styles.scanBtn, pressed && styles.scanBtnPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/camera')
          }}
        >
          <Ionicons name="camera" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.scanBtnText}>Scan Animal</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#61B6A9',
  },
  safe: {
    flex: 1,
    backgroundColor: '#61B6A9',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSafe: {
    backgroundColor: '#61B6A9',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF5A5F',
    borderWidth: 1.5,
    borderColor: '#61B6A9',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  habitatContainer: {
    width: '100%',
    height: 240,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  habitatBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  habitatImageStyle: {
    borderRadius: 28,
  },
  mascotContainer: {
    marginBottom: 16,
  },
  mascotImage: {
    width: 80,
    height: 80,
  },
  adventureBanner: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  adventureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  boltBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adventureTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  progressTrack: {
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 11,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FFD13B',
    borderRadius: 11,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2F4F4F',
    zIndex: 2,
  },
  goalsSection: {
    marginTop: 20,
  },
  goalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  goalsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  goalsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  goalCardCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  goalStickerFrame: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FAF5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalSticker: {
    width: 36,
    height: 36,
  },
  goalTextContainer: {
    flex: 1,
  },
  goalName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#22332D',
    letterSpacing: -0.2,
  },
  goalTextDone: {
    textDecorationLine: 'line-through',
    color: '#8A9E96',
  },
  goalCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#768E85',
    marginTop: 2,
  },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EAEFEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkBtnDone: {
    backgroundColor: '#61B6A9',
  },
  scanBtn: {
    marginTop: 14,
    backgroundColor: '#2F7D5B',
    borderRadius: 24,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  scanBtnPressed: {
    opacity: 0.88,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
})

