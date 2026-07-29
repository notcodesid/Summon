import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { useFocusEffect } from 'expo-router'
import { theme } from '@/constants/theme'
import { MicroLabel } from '@/components/ui'
import { loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { usePlayer } from '@/lib/use-player'

/** Collection of animals the player has actually scanned and kept. */
export default function CollectionScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const { privyUserId } = usePlayer()
  const liquid = isLiquidGlassAvailable()

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

  const count = creatures?.length ?? 0

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.masthead}>
          <Text style={styles.wordmark}>Collection</Text>
          <MicroLabel color={theme.colors.textMuted}>
            {count} saved
          </MicroLabel>
        </View>

        {creatures === null ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : creatures.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={30} color={theme.colors.textFaint} />
            <Text style={styles.emptyTitle}>nothing saved</Text>
            <Text style={styles.emptyBody}>
              animals you scan and keep will show up here.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.listHeader}>
              <MicroLabel>{count} animals</MicroLabel>
            </View>

            <View style={styles.grid}>
              {creatures.map((creature) => (
                <CollectionTile key={creature.id} creature={creature} liquid={liquid} />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  )
}

function CollectionTile({
  creature,
  liquid,
}: {
  creature: Creature
  liquid: boolean
}) {
  const name = creature.commonName || creature.species

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
      {creature.photoUri ? (
        <Image source={{ uri: creature.photoUri }} style={styles.tilePhoto} />
      ) : (
        <View style={[styles.tilePhoto, styles.photoPlaceholder]}>
          <Ionicons name="paw-outline" size={28} color={theme.colors.textFaint} />
        </View>
      )}
      <View style={styles.tileBody}>
        <Text style={styles.tileName} numberOfLines={1}>
          {name}
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
  scrollContent: {
    paddingBottom: 140,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 96,
    gap: theme.space.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    maxWidth: 260,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  listHeader: {
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
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
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
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
