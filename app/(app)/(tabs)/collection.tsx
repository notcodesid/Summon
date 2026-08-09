import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { router, useFocusEffect } from 'expo-router'
import { MicroLabel, PrimaryButton } from '@/components/ui'
import { theme } from '@/constants/theme'
import { loadCollection } from '@/lib/collection'
import { RARITY_LABEL, RARITY_ORDER, type Creature } from '@/lib/creatures'
import { filterCollection, type CollectionFilter } from '@/lib/discovery-library'
import { usePlayer } from '@/lib/use-player'

const FILTERS: CollectionFilter[] = ['all', ...RARITY_ORDER]

/** The complete searchable library of animals the player has saved. */
export default function CollectionScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CollectionFilter>('all')
  const { privyUserId } = usePlayer()
  const { width } = useWindowDimensions()
  const liquid = isLiquidGlassAvailable()
  const gap = theme.space.md
  const tileWidth = Math.floor((width - theme.space.xl * 2 - gap) / 2)

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

  const visible = useMemo(() => filterCollection(creatures ?? [], query, filter), [creatures, filter, query])

  if (creatures === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.masthead}>
          <View>
            <MicroLabel color={theme.colors.textMuted}>your library</MicroLabel>
            <Text style={styles.wordmark}>Collection</Text>
          </View>
          <MicroLabel color={theme.colors.textMuted}>{creatures.length} saved</MicroLabel>
        </View>

        {creatures.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="images-outline" size={30} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>Every animal you keep will appear here.</Text>
            <View style={styles.emptyAction}>
              <PrimaryButton label="scan your first animal" onPress={() => router.push('/camera')} />
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.search, !liquid && styles.fallbackSearch]}>
              {liquid ? (
                <GlassView
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                  glassEffectStyle="regular"
                  tintColor={theme.colors.glassSurfaceStrong}
                />
              ) : null}
              <Ionicons name="search" size={19} color={theme.colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
                placeholder="search names, species, notes"
                placeholderTextColor={theme.colors.textFaint}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search collection"
              />
              {query ? (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={19} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              style={styles.filterScroll}
            >
              {FILTERS.map((option) => {
                const selected = filter === option
                return (
                  <Pressable
                    key={option}
                    onPress={() => setFilter(option)}
                    style={({ pressed }) => [
                      styles.filter,
                      selected && styles.filterSelected,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Filter by ${option}`}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                      {option === 'all' ? 'all' : RARITY_LABEL[option]}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.resultsRow}>
              <MicroLabel color={theme.colors.textMuted}>
                {visible.length === creatures.length
                  ? `${creatures.length} animals`
                  : `${visible.length} of ${creatures.length}`}
              </MicroLabel>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {visible.length === 0 ? (
                <View style={styles.noResults}>
                  <Ionicons name="search-outline" size={28} color={theme.colors.textFaint} />
                  <Text style={styles.noResultsTitle}>No matches</Text>
                  <Text style={styles.noResultsBody}>Try another name, species, note, or rarity.</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {visible.map((creature) => (
                    <CollectionTile key={creature.id} creature={creature} liquid={liquid} width={tileWidth} />
                  ))}
                </View>
              )}
            </ScrollView>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

function CollectionTile({ creature, liquid, width }: { creature: Creature; liquid: boolean; width: number }) {
  const name = creature.commonName || creature.species

  return (
    <View style={[styles.tile, { width }, !liquid && styles.fallbackCard]}>
      {liquid ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          tintColor={theme.colors.glassSurfaceStrong}
          pointerEvents="none"
        />
      ) : null}
      {creature.photoUri ? (
        <Image source={{ uri: creature.photoUri }} style={styles.tilePhoto} resizeMode="cover" />
      ) : (
        <View style={[styles.tilePhoto, styles.photoPlaceholder]}>
          <Ionicons name="paw-outline" size={28} color={theme.colors.textFaint} />
        </View>
      )}
      <View style={styles.tileBody}>
        <MicroLabel color={theme.colors.textMuted}>{RARITY_LABEL[creature.rarity]}</MicroLabel>
        <Text style={styles.tileName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.tileSpecies} numberOfLines={1}>
          {creature.species}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: theme.space.xxl,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  emptyTitle: {
    marginTop: theme.space.lg,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: theme.colors.text,
  },
  emptyBody: {
    marginTop: theme.space.sm,
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  emptyAction: {
    alignSelf: 'stretch',
    marginTop: theme.space.xxl,
  },
  search: {
    minHeight: 50,
    marginTop: theme.space.xxl,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
  },
  fallbackSearch: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    height: 50,
    paddingVertical: 0,
    fontSize: 15,
    color: theme.colors.text,
  },
  filterScroll: {
    flexGrow: 0,
    marginHorizontal: -theme.space.xl,
  },
  filters: {
    gap: theme.space.sm,
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.md,
  },
  filter: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  filterSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  filterTextSelected: {
    color: theme.colors.onPrimary,
  },
  resultsRow: {
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.md,
  },
  content: {
    flex: 1,
    marginHorizontal: -theme.space.xl,
  },
  scrollContent: {
    paddingHorizontal: theme.space.xl,
    paddingBottom: theme.space.section,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
  },
  tile: {
    borderRadius: theme.radius.tile,
    overflow: 'hidden',
    minHeight: 230,
  },
  fallbackCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tilePhoto: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceRaised,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: {
    padding: theme.space.md,
  },
  tileName: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: theme.colors.text,
  },
  tileSpecies: {
    marginTop: 2,
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.colors.textMuted,
  },
  noResults: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsTitle: {
    marginTop: theme.space.md,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  noResultsBody: {
    maxWidth: 260,
    marginTop: theme.space.sm,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
})
