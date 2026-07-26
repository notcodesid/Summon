import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { theme } from '@/constants/theme'
import {
  MicroLabel,
  PrimaryButton,
  RarityDot,
  Rule,
  ScreenHeader,
} from '@/components/ui'
import { loadCollection } from '@/lib/collection'
import { RARITY_COLOR, powerOf, type Creature } from '@/lib/creatures'
import { usePlayer } from '@/lib/use-player'

/**
 * The index of everything caught, newest first.
 */
export default function CollectionScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const { privyUserId } = usePlayer()

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

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="collection" onBack={goBack} />
      <Rule />

      {creatures === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : creatures.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name="scan-outline"
            size={30}
            color={theme.colors.textFaint}
          />
          <Text style={styles.emptyTitle}>no specimens yet</Text>
          <Text style={styles.emptyBody}>
            every animal you scan is catalogued here with its rarity and stats.
          </Text>
          <View style={styles.emptyAction}>
            <PrimaryButton
              label="scan"
              onPress={() => router.replace('/camera')}
              accessibilityLabel="Open camera to scan an animal"
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={creatures}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <MicroLabel>
                {creatures.length} {creatures.length === 1 ? 'entry' : 'entries'}
              </MicroLabel>
            </View>
          }
          renderItem={({ item }) => <CreatureTile creature={item} />}
        />
      )}
    </SafeAreaView>
  )
}

function CreatureTile({ creature }: { creature: Creature }) {
  const accent = RARITY_COLOR[creature.rarity]
  return (
    <View style={styles.tile}>
      <Image source={{ uri: creature.photoUri }} style={styles.tilePhoto} />
      <View style={styles.tileBody}>
        <View style={styles.tileRarity}>
          <RarityDot color={accent} />
          <MicroLabel color={accent}>{creature.rarity}</MicroLabel>
        </View>
        <Text style={styles.tileName} numberOfLines={1}>
          {creature.commonName}
        </Text>
        <Text style={styles.tileSpecies} numberOfLines={1}>
          {creature.species}
        </Text>
        <View style={styles.tileFooter}>
          <MicroLabel>power</MicroLabel>
          <Text style={styles.tilePower}>{powerOf(creature.stats)}</Text>
        </View>
      </View>
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
    paddingHorizontal: theme.space.xxl,
    gap: theme.space.md,
  },
  emptyTitle: {
    marginTop: theme.space.xs,
    fontSize: theme.type.title.fontSize,
    fontWeight: theme.type.title.fontWeight,
    letterSpacing: theme.type.title.letterSpacing,
    color: theme.colors.text,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyAction: {
    marginTop: theme.space.lg,
    alignSelf: 'stretch',
    paddingHorizontal: theme.space.xxl,
  },
  list: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xxl,
  },
  listHeader: {
    paddingVertical: theme.space.lg,
  },
  row: {
    gap: theme.space.md,
    marginBottom: theme.space.md,
  },
  tile: {
    flex: 1,
    // Without a ceiling, a lone tile in the last row stretches full width.
    maxWidth: '48.5%',
    borderRadius: theme.radius.tile,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  tilePhoto: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceRaised,
  },
  tileBody: {
    padding: theme.space.md,
    gap: 3,
  },
  tileRarity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  tileName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: theme.colors.text,
  },
  tileSpecies: {
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.colors.textFaint,
  },
  tileFooter: {
    marginTop: theme.space.sm,
    paddingTop: theme.space.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.rule,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tilePower: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
})
