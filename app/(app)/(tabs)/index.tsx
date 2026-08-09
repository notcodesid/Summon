import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { router, useFocusEffect } from 'expo-router'
import { MicroLabel, PrimaryButton } from '@/components/ui'
import { theme } from '@/constants/theme'
import { loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { latestDiscovery, uniqueSpeciesCount, weeklyDiscoveryPrompt } from '@/lib/discovery-library'
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.masthead}>
          <View>
            <MicroLabel color={theme.colors.textMuted}>field journal</MicroLabel>
            <Text style={styles.wordmark}>Home</Text>
          </View>
          <Pressable
            onPress={() => router.push('/collection')}
            hitSlop={10}
            style={({ pressed }) => [styles.libraryLink, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open collection"
          >
            <Ionicons name="albums-outline" size={18} color={theme.colors.text} />
            <Text style={styles.libraryLinkText}>collection</Text>
          </Pressable>
        </View>

        <View style={styles.metrics}>
          <Metric label="discoveries" value={String(creatures.length)} liquid={liquid} />
          <Metric label="species" value={String(speciesCount)} liquid={liquid} />
        </View>

        <View style={styles.sectionHeader}>
          <MicroLabel>recent discovery</MicroLabel>
        </View>
        <Surface liquid={liquid} style={styles.recentCard}>
          {recent ? (
            <>
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
            </>
          ) : (
            <View style={styles.emptyRecent}>
              <View style={styles.emptyIcon}>
                <Ionicons name="paw-outline" size={28} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Your first find starts here</Text>
              <Text style={styles.emptyBody}>Photograph a real animal and give it a name of your own.</Text>
            </View>
          )}
        </Surface>

        <View style={styles.sectionHeader}>
          <MicroLabel>this week</MicroLabel>
        </View>
        <Surface liquid={liquid} style={styles.promptCard}>
          <View style={styles.promptIcon}>
            <Ionicons name="compass-outline" size={22} color={theme.colors.text} />
          </View>
          <View style={styles.promptCopy}>
            <Text style={styles.promptTitle}>Weekly prompt</Text>
            <Text style={styles.promptBody}>{weeklyPrompt}</Text>
          </View>
        </Surface>

        <View style={styles.actions}>
          <PrimaryButton label="scan an animal" onPress={() => router.push('/camera')} />
          {creatures.length > 0 ? (
            <Pressable
              onPress={() => router.push('/collection')}
              style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Browse full collection"
            >
              <Text style={styles.secondaryActionText}>browse all {creatures.length}</Text>
              <Ionicons name="arrow-forward" size={17} color={theme.colors.text} />
            </Pressable>
          ) : null}
        </View>
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

function Metric({ label, value, liquid }: { label: string; value: string; liquid: boolean }) {
  return (
    <Surface liquid={liquid} style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <MicroLabel color={theme.colors.textMuted}>{label}</MicroLabel>
    </Surface>
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  wordmark: {
    marginTop: 2,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.colors.text,
  },
  libraryLink: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  libraryLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  metrics: {
    flexDirection: 'row',
    gap: theme.space.md,
    marginTop: theme.space.xxl,
  },
  metric: {
    flex: 1,
    minHeight: 116,
    justifyContent: 'space-between',
    padding: theme.space.lg,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
  },
  metricValue: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
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
    borderRadius: theme.radius.card,
    overflow: 'hidden',
  },
  recentPhotoFrame: {
    width: '100%',
    aspectRatio: 1.42,
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
    padding: theme.space.lg,
  },
  recentName: {
    marginTop: 5,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: theme.colors.text,
  },
  recentSpecies: {
    marginTop: 4,
    fontSize: 14,
    fontStyle: 'italic',
    color: theme.colors.textMuted,
  },
  emptyRecent: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.xxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  emptyTitle: {
    marginTop: theme.space.lg,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    maxWidth: 260,
    marginTop: theme.space.sm,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  promptCard: {
    minHeight: 104,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
    padding: theme.space.lg,
  },
  promptIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  promptCopy: {
    flex: 1,
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  promptBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
  actions: {
    gap: theme.space.md,
    paddingTop: theme.space.xxl,
  },
  secondaryAction: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  pressed: {
    opacity: 0.68,
  },
})
