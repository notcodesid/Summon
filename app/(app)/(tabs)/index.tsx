import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import { MicroLabel } from '@/components/ui'
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
  const [completedMissions, setCompletedMissions] = useState<Record<string, boolean>>({
    flyer: false,
    explore: false,
    battle: false,
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
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  const recent = latestDiscovery(creatures)
  const speciesCount = uniqueSpeciesCount(creatures)
  const milestone = nextSpeciesMilestone(creatures)
  const milestonePercent = Math.min(
    100,
    Math.round((milestone.current / Math.max(1, milestone.target)) * 100),
  )

  const toggleMission = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setCompletedMissions((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Explorer Masthead */}
        <View style={styles.masthead}>
          <View style={styles.mastheadLeft}>
            <MicroLabel color={theme.colors.primary}>REAL-WORLD ANIMAL COLLECTION</MicroLabel>
            <Text style={styles.wordmark}>Summon</Text>
          </View>
          <Pressable
            style={styles.profileBadge}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="leaf" size={16} color={theme.colors.primary} />
            <Text style={styles.profileBadgeText}>{speciesCount} Species</Text>
          </Pressable>
        </View>

        {/* Lead Creature Companion / Recent Discovery Hero Card */}
        {recent ? (
          <View style={styles.leadCard}>
            <View style={styles.leadHeader}>
              <View style={styles.leadLabelRow}>
                <Image
                  source={require('@/assets/goal-icons/lead_badge.png')}
                  style={styles.leadBadgeIcon}
                  contentFit="contain"
                />
                <Text style={styles.leadLabel}>LEAD COMPANION</Text>
              </View>
              <View style={styles.rarityPill}>
                <Text style={styles.rarityText}>{recent.rarity.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.leadBody}>
              <View style={styles.leadPhotoFrame}>
                {recent.photoUri ? (
                  <Image source={{ uri: recent.photoUri }} style={styles.leadPhoto} contentFit="cover" />
                ) : (
                  <View style={styles.leadPhotoPlaceholder}>
                    <Ionicons name="paw" size={40} color={theme.colors.primary} />
                  </View>
                )}
              </View>
              <View style={styles.leadInfo}>
                <Text style={styles.leadName}>{recent.commonName || recent.species}</Text>
                <Text style={styles.leadSpecies}>{recent.species}</Text>
                {recent.stats ? (
                  <View style={styles.statBadges}>
                    <View style={styles.statBadgeItem}>
                      <Text style={styles.statBadgeLabel}>HP</Text>
                      <Text style={styles.statBadgeValue}>{recent.stats.hp}</Text>
                    </View>
                    <View style={styles.statBadgeItem}>
                      <Text style={styles.statBadgeLabel}>ATK</Text>
                      <Text style={styles.statBadgeValue}>{recent.stats.attack}</Text>
                    </View>
                    <View style={styles.statBadgeItem}>
                      <Text style={styles.statBadgeLabel}>DEF</Text>
                      <Text style={styles.statBadgeValue}>{recent.stats.defense}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyLeadCard}>
            <Image
              source={require('@/assets/tab-icons-transparent/home.png')}
              style={styles.emptySticker}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>No Animals Summoned Yet</Text>
            <Text style={styles.emptySub}>
              Head outside, point your camera at a real animal, and turn it into your first onchain companion!
            </Text>
          </View>
        )}

        {/* Primary Scan Camera CTA */}
        <Pressable
          style={({ pressed }) => [styles.radarCta, pressed && styles.radarCtaPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/camera')
          }}
        >
          <View style={styles.radarIconRing}>
            <Ionicons name="scan-outline" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.radarTextGroup}>
            <Text style={styles.radarTitle}>Point Camera & Scan</Text>
            <Text style={styles.radarSub}>Capture real wildlife to collect & battle</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>

        {/* Milestone Expedition Progress Banner */}
        <View style={styles.milestoneBanner}>
          <View style={styles.milestoneHeader}>
            <Ionicons name="compass-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.milestoneTitle}>Species Discovery Progress</Text>
            <Text style={styles.milestoneCount}>
              {milestone.current} / {milestone.target}
            </Text>
          </View>
          <View style={styles.milestoneTrack}>
            <View style={[styles.milestoneFill, { width: `${milestonePercent}%` }]} />
          </View>
        </View>

        {/* Summon Field Missions (Real Animal Quests) */}
        <View style={styles.missionsSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.text} />
            <Text style={styles.sectionTitle}>Field Quests</Text>
          </View>

          {/* Mission 1: Real animal prompt */}
          <Pressable
            style={[styles.missionCard, completedMissions.explore && styles.missionCompleted]}
            onPress={() => toggleMission('explore')}
          >
            <View style={styles.missionStickerFrame}>
              <Image
                source={require('@/assets/goal-icons/sunflower.png')}
                style={styles.missionSticker}
                contentFit="contain"
              />
            </View>
            <View style={styles.missionTextGroup}>
              <Text style={[styles.missionTitle, completedMissions.explore && styles.missionTextDone]}>
                {weeklyPrompt}
              </Text>
              <Text style={styles.missionReward}>+50 XP • Species Discovery</Text>
            </View>
            <View style={[styles.checkPill, completedMissions.explore && styles.checkPillDone]}>
              <Ionicons
                name="checkmark"
                size={16}
                color={completedMissions.explore ? '#FFFFFF' : theme.colors.textFaint}
              />
            </View>
          </Pressable>

          {/* Mission 2: Scan 2 Animals */}
          <Pressable
            style={[styles.missionCard, completedMissions.flyer && styles.missionCompleted]}
            onPress={() => toggleMission('flyer')}
          >
            <View style={styles.missionStickerFrame}>
              <Image
                source={require('@/assets/tab-icons-transparent/home.png')}
                style={styles.missionSticker}
                contentFit="contain"
              />
            </View>
            <View style={styles.missionTextGroup}>
              <Text style={[styles.missionTitle, completedMissions.flyer && styles.missionTextDone]}>
                Scan 2 animals in the wild
              </Text>
              <Text style={styles.missionReward}>+25 XP • Daily Expedition</Text>
            </View>
            <View style={[styles.checkPill, completedMissions.flyer && styles.checkPillDone]}>
              <Ionicons
                name="checkmark"
                size={16}
                color={completedMissions.flyer ? '#FFFFFF' : theme.colors.textFaint}
              />
            </View>
          </Pressable>

          {/* Mission 3: Onchain Battle */}
          <Pressable
            style={[styles.missionCard, completedMissions.battle && styles.missionCompleted]}
            onPress={() => toggleMission('battle')}
          >
            <View style={styles.missionStickerFrame}>
              <Image
                source={require('@/assets/goal-icons/battle.png')}
                style={styles.missionSticker}
                contentFit="contain"
              />
            </View>
            <View style={styles.missionTextGroup}>
              <Text style={[styles.missionTitle, completedMissions.battle && styles.missionTextDone]}>
                Challenge a rival in battle
              </Text>
              <Text style={styles.missionReward}>+100 XP • Onchain Combat</Text>
            </View>
            <View style={[styles.checkPill, completedMissions.battle && styles.checkPillDone]}>
              <Ionicons
                name="checkmark"
                size={16}
                color={completedMissions.battle ? '#FFFFFF' : theme.colors.textFaint}
              />
            </View>
          </Pressable>
        </View>

        {/* Recent Animal Specimen Gallery */}
        {creatures.length > 0 ? (
          <View style={styles.gallerySection}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="library-outline" size={18} color={theme.colors.text} />
              <Text style={styles.sectionTitle}>Recent Discoveries</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
              {creatures.slice(0, 6).map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.galleryTile}
                  onPress={() => router.push('/collection')}
                >
                  {c.photoUri ? (
                    <Image source={{ uri: c.photoUri }} style={styles.galleryPhoto} contentFit="cover" />
                  ) : (
                    <View style={styles.galleryPlaceholder}>
                      <Ionicons name="paw" size={24} color={theme.colors.textFaint} />
                    </View>
                  )}
                  <View style={styles.galleryMeta}>
                    <Text style={styles.galleryName} numberOfLines={1}>
                      {c.commonName || c.species}
                    </Text>
                    <Text style={styles.gallerySpecies} numberOfLines={1}>
                      {c.species}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mastheadLeft: {
    flex: 1,
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    color: theme.colors.text,
    marginTop: 2,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.speciesSurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  profileBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  leadCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  leadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  leadLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadBadgeIcon: {
    width: 24,
    height: 24,
  },
  leadLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.primary,
  },
  rarityPill: {
    backgroundColor: theme.colors.discoverySurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: theme.colors.discoveryAccent,
  },
  leadBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  leadPhotoFrame: {
    width: 88,
    height: 88,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceRaised,
  },
  leadPhoto: {
    width: '100%',
    height: '100%',
  },
  leadPhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  leadSpecies: {
    fontSize: 13,
    fontStyle: 'italic',
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  statBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  statBadgeItem: {
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  statBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textFaint,
  },
  statBadgeValue: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.text,
  },
  emptyLeadCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptySticker: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  radarCta: {
    backgroundColor: theme.colors.primary,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2F7D5B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  radarCtaPressed: {
    opacity: 0.88,
  },
  radarIconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  radarTextGroup: {
    flex: 1,
  },
  radarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  radarSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  milestoneBanner: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  milestoneTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  milestoneCount: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  milestoneTrack: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  milestoneFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  missionsSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.rule,
  },
  missionCompleted: {
    opacity: 0.65,
    backgroundColor: theme.colors.surfaceRaised,
  },
  missionStickerFrame: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  missionSticker: {
    width: 32,
    height: 32,
  },
  missionTextGroup: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  missionTextDone: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  missionReward: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 2,
  },
  checkPill: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPillDone: {
    backgroundColor: theme.colors.primary,
  },
  gallerySection: {
    marginBottom: 10,
  },
  galleryScroll: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
  galleryTile: {
    width: 120,
    marginRight: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  galleryPhoto: {
    width: '100%',
    height: 90,
  },
  galleryPlaceholder: {
    width: '100%',
    height: 90,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryMeta: {
    padding: 8,
  },
  galleryName: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
  },
  gallerySpecies: {
    fontSize: 10,
    fontStyle: 'italic',
    color: theme.colors.textMuted,
    marginTop: 1,
  },
})


