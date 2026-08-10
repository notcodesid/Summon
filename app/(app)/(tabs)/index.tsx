import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { router, useFocusEffect } from 'expo-router'
import { MicroLabel, PrimaryButton } from '@/components/ui'
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

/** Home is the discovery dashboard, not a second copy of the collection. */
export default function HomeScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const { privyUserId } = usePlayer()
  const liquid = isLiquidGlassAvailable()
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
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const recent = latestDiscovery(creatures)
  const speciesCount = uniqueSpeciesCount(creatures)
  const milestone = nextSpeciesMilestone(creatures)
  const milestoneWidth = `${Math.round(milestone.progress * 100)}%` as `${number}%`

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.masthead}>
          <MicroLabel color={theme.colors.textMuted}>field journal</MicroLabel>
          <Text style={styles.wordmark}>Home</Text>
        </View>

        <View style={styles.stats}>
          <Stat label="discoveries" value={String(creatures.length)} />
          <View style={styles.statDivider} />
          <Stat label="species" value={String(speciesCount)} />
        </View>

        <View style={styles.sectionHeader}>
          <MicroLabel>this week</MicroLabel>
        </View>
        <Surface liquid={liquid} style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyPrompt}>{weeklyPrompt}</Text>
            <Ionicons name="compass-outline" size={24} color={theme.colors.textMuted} />
          </View>

          <View style={styles.milestoneRow}>
            <Text style={styles.milestoneLabel}>Next milestone</Text>
            <Text style={styles.milestoneCount}>
              {milestone.current} / {milestone.target} species
            </Text>
          </View>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: milestone.target,
              now: milestone.current,
            }}
          >
            <View style={[styles.progressFill, { width: milestoneWidth }]} />
          </View>
        </Surface>

        <View style={styles.primaryAction}>
          <PrimaryButton label="scan an animal" onPress={() => router.push('/camera')} />
        </View>

        {recent ? (
          <>
            <View style={styles.sectionHeader}>
              <MicroLabel>recent discovery</MicroLabel>
            </View>
            <Surface liquid={liquid} style={styles.recentCard}>
              <View style={styles.recentPhotoFrame}>
                {recent.photoUri ? (
                  <Image source={{ uri: recent.photoUri }} style={styles.recentPhoto} resizeMode="cover" />
                ) : (
                  <View style={[styles.recentPhoto, styles.photoPlaceholder]}>
                    <Ionicons name="paw-outline" size={38} color={theme.colors.textFaint} />
                  </View>
                )}
              </View>
              <View style={styles.recentBody}>
                <MicroLabel color={theme.colors.textMuted}>latest find</MicroLabel>
                <Text style={styles.recentName}>{recent.commonName || recent.species}</Text>
                <Text style={styles.recentSpecies} numberOfLines={1}>
                  {recent.species}
                </Text>
              </View>
            </Surface>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function Surface({ liquid, style, children }: { liquid: boolean; style: object; children: ReactNode }) {
  if (liquid) {
    return (
      <GlassView style={style} glassEffectStyle="regular" tintColor={theme.colors.glassSurfaceStrong}>
        {children}
      </GlassView>
    )
  }

  return <View style={[style, styles.fallbackSurface]}>{children}</View>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <MicroLabel color={theme.colors.textMuted}>{label}</MicroLabel>
    </View>
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
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.section,
  },
  masthead: {
    alignItems: 'flex-start',
  },
  wordmark: {
    marginTop: 2,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.colors.text,
  },
  stats: {
    marginTop: theme.space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.space.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.rule,
  },
  stat: {
    flex: 1,
    gap: 3,
  },
  statValue: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    height: 42,
    marginHorizontal: theme.space.xl,
    backgroundColor: theme.colors.rule,
  },
  fallbackSurface: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeader: {
    paddingTop: theme.space.xxl,
    paddingBottom: theme.space.md,
  },
  recentCard: {
    minHeight: 124,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  recentPhotoFrame: {
    width: 108,
    height: 108,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden',
  },
  recentPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
  },
  recentBody: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
  },
  recentName: {
    marginTop: 5,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: theme.colors.text,
  },
  recentSpecies: {
    marginTop: 4,
    fontSize: 14,
    fontStyle: 'italic',
    color: theme.colors.textMuted,
  },
  weeklyCard: {
    minHeight: 184,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    padding: theme.space.xl,
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.lg,
  },
  weeklyPrompt: {
    flex: 1,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.65,
    color: theme.colors.text,
  },
  milestoneRow: {
    marginTop: theme.space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  milestoneCount: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    marginTop: theme.space.sm,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceRaised,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  primaryAction: {
    marginTop: theme.space.lg,
  },
})
