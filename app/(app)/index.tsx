import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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

/** Home shows the user's real collection, newest first. */
export default function HomeScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const [selected, setSelected] = useState<Creature | null>(null)
  const { privyUserId } = usePlayer()
  const { width } = useWindowDimensions()
  const liquid = isLiquidGlassAvailable()
  const cardGap = theme.space.md
  const cardWidth = Math.min(
    180,
    Math.floor((width - theme.space.xl * 2 - cardGap) / 2),
  )

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
          <Text style={styles.wordmark}>Home</Text>
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
            <View style={styles.emptyIconGlass}>
              <Ionicons name="paw-outline" size={32} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>no animals yet</Text>
            <Text style={styles.emptyBody}>
              open the camera and scan a real animal you find.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            // Nested glass containers steal multi-touch hit targets; plain
            // ScrollView + Pressable keeps every card independently tappable.
            keyboardShouldPersistTaps="handled"
          >
            {creatures.map((creature) => (
              <CreatureCard
                key={creature.id}
                creature={creature}
                cardWidth={cardWidth}
                liquid={liquid}
                onPress={() => setSelected(creature)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => setSelected(null)}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
        >
          <View style={styles.previewCard} pointerEvents="box-none">
            {liquid ? (
              <GlassView
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                glassEffectStyle="regular"
                tintColor="rgba(255,255,255,0.12)"
              />
            ) : null}
            {selected ? (
              <>
                <View style={styles.previewImageFrame}>
                  {selected.photoUri ? (
                    <Image
                      source={{ uri: selected.photoUri }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.previewImage, styles.photoPlaceholder]}>
                      <Ionicons name="paw-outline" size={40} color={theme.colors.textFaint} />
                    </View>
                  )}
                </View>
                <View style={styles.previewBody}>
                  <Text style={styles.previewTitle}>
                    {selected.commonName || selected.species}
                  </Text>
                  <Text style={styles.previewSubtitle}>added to your collection</Text>
                </View>
              </>
            ) : null}
            <Pressable
              onPress={() => setSelected(null)}
              style={({ pressed }) => [styles.previewClose, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.previewCloseText}>done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function CreatureCard({
  creature,
  cardWidth,
  liquid,
  onPress,
}: {
  creature: Creature
  cardWidth: number
  liquid: boolean
  onPress: () => void
}) {
  const orbSize = cardWidth * 0.66
  const name = creature.commonName || creature.species

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth, minHeight: cardWidth * 1.14 },
        !liquid && styles.fallbackCard,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="imagebutton"
      accessibilityLabel={name}
    >
      {/* Visual shell only — never isInteractive / GlassContainer here, or
          iOS liquid glass can lock hit-testing to a single sibling. */}
      {liquid ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          tintColor="rgba(255,255,255,0.10)"
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.cardContent} pointerEvents="none">
        <View
          style={[
            styles.photoOrb,
            {
              width: orbSize,
              height: orbSize,
              borderRadius: orbSize / 2,
            },
          ]}
        >
          {creature.photoUri ? (
            <Image source={{ uri: creature.photoUri }} style={styles.animalImage} />
          ) : (
            <View style={[styles.animalImage, styles.photoPlaceholder]}>
              <Ionicons name="paw-outline" size={28} color={theme.colors.textFaint} />
            </View>
          )}
          {liquid ? (
            <GlassView
              pointerEvents="none"
              style={styles.photoOrbGlass}
              glassEffectStyle="clear"
              tintColor="rgba(255,255,255,0.18)"
            />
          ) : null}
          <View pointerEvents="none" style={styles.photoOrbRim} />
          <View pointerEvents="none" style={styles.photoOrbGlint} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Pressable>
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
  scroll: {
    flex: 1,
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
  emptyIconGlass: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.rule,
  },
  emptyTitle: {
    marginTop: theme.space.md,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    maxWidth: 260,
    fontSize: 16,
    lineHeight: 23,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
    paddingTop: theme.space.xl,
    paddingBottom: 220,
  },
  card: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
  },
  fallbackCard: {
    borderWidth: 1,
    borderColor: theme.colors.rule,
    backgroundColor: theme.colors.surface,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.md,
  },
  cardPressed: {
    opacity: 0.72,
  },
  photoOrb: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  animalImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.04 }],
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    transform: [],
  },
  photoOrbGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
  },
  photoOrbRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  photoOrbGlint: {
    position: 'absolute',
    top: 14,
    left: 18,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  cardTitle: {
    marginTop: theme.space.lg,
    textAlign: 'center',
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.35,
    color: theme.colors.text,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xl,
  },
  previewCard: {
    width: '88%',
    maxWidth: 360,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    padding: 6,
  },
  previewImageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 29,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceRaised,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBody: {
    alignItems: 'center',
    paddingTop: theme.space.lg,
    paddingHorizontal: theme.space.lg,
    gap: 4,
  },
  previewTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: theme.colors.text,
    textAlign: 'center',
  },
  previewSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  previewClose: {
    alignSelf: 'center',
    marginTop: theme.space.md,
    marginBottom: theme.space.sm,
    minHeight: 44,
    minWidth: 132,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  previewCloseText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
})
