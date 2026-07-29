import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { theme } from '@/constants/theme'
import { MicroLabel } from '@/components/ui'
import { animalImageAt } from '@/lib/animal-images'

type CollectionAnimal = {
  id: string
  name: string
  image: ImageSourcePropType
}

const COLLECTION_ANIMALS: CollectionAnimal[] = [
  { id: 'scout', name: 'Scout', image: animalImageAt(0)! },
  { id: 'miso', name: 'Miso', image: animalImageAt(1)! },
  { id: 'ember', name: 'Ember', image: animalImageAt(2)! },
  { id: 'orion', name: 'Orion', image: animalImageAt(3)! },
  { id: 'clover', name: 'Clover', image: animalImageAt(4)! },
  { id: 'willow', name: 'Willow', image: animalImageAt(5)! },
]

/** Mock collection screen, opened from Profile. */
export default function CollectionScreen() {
  const liquid = isLiquidGlassAvailable()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.masthead}>
          <Text style={styles.wordmark}>Collection</Text>
          <MicroLabel color={theme.colors.textMuted}>
            {COLLECTION_ANIMALS.length} saved
          </MicroLabel>
        </View>

        <View style={styles.content}>
        <View style={styles.listHeader}>
          <MicroLabel>{COLLECTION_ANIMALS.length} animals</MicroLabel>
        </View>

        <View style={styles.grid}>
          {COLLECTION_ANIMALS.map((animal) => (
            <CollectionTile key={animal.id} animal={animal} liquid={liquid} />
          ))}
        </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

function CollectionTile({
  animal,
  liquid,
}: {
  animal: CollectionAnimal
  liquid: boolean
}) {
  return (
    <View style={[styles.tile, !liquid && styles.fallbackCard]}>
      {liquid ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          tintColor="rgba(255,255,255,0.10)"
          pointerEvents="none"
        />
      ) : null}
      <Image source={animal.image} style={styles.tilePhoto} />
      <View style={styles.tileBody}>
        <Text style={styles.tileName} numberOfLines={1}>
          {animal.name}
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
    paddingBottom: theme.space.xxl,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
  },
  listHeader: {
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
    paddingBottom: 140,
  },
  tile: {
    width: '47.8%',
    borderRadius: theme.radius.tile,
    overflow: 'hidden',
    minHeight: 206,
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
  tileBody: {
    padding: theme.space.md,
  },
  tileName: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: theme.colors.text,
  },
})
