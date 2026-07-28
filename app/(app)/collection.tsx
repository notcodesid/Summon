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
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { router, useFocusEffect } from 'expo-router'
import { theme } from '@/constants/theme'
import { MicroLabel, PrimaryButton, Rule, ScreenHeader } from '@/components/ui'
import { loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { usePlayer } from '@/lib/use-player'

/** The index of everything saved, newest first. */
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
          <Ionicons name="scan-outline" size={30} color={theme.colors.textFaint} />
          <Text style={styles.emptyTitle}>nothing saved yet</Text>
          <Text style={styles.emptyBody}>
            Take a picture, name it, and add it to your collection.
          </Text>
          <View style={styles.emptyAction}>
            <PrimaryButton
              label="scan"
              onPress={() => router.replace('/camera')}
              accessibilityLabel="Open camera"
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
                {creatures.length} {creatures.length === 1 ? 'animal' : 'animals'}
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
  const liquid = isLiquidGlassAvailable()

  // Avoid GlassContainer around list cells — it can monopolize hit testing
  // across siblings so only one tile stays tappable.
  return (
    <View style={[styles.tile, !liquid && styles.fallbackCard]}>
      {liquid ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          pointerEvents="none"
        />
      ) : null}
      <View style={styles.tileContent} pointerEvents="none">
        <Image source={{ uri: creature.photoUri }} style={styles.tilePhoto} />
        <Text style={styles.tileName} numberOfLines={2}>
          {creature.commonName}
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
    maxWidth: '48.5%',
    borderRadius: theme.radius.tile,
    overflow: 'hidden',
  },
  tileContent: {
    flex: 1,
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
  tileName: {
    padding: theme.space.md,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.35,
    color: theme.colors.text,
  },
})
