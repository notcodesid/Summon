import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { useFocusEffect } from 'expo-router'
import { theme } from '@/constants/theme'
import { MicroLabel } from '@/components/ui'
import { loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { usePlayer } from '@/lib/use-player'

/** Home shows the user's real collection, newest first. */
export default function HomeScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.masthead}>
          <Text style={styles.wordmark}>Home</Text>
          {creatures?.length ? (
            <MicroLabel color={theme.colors.textMuted}>
              {creatures.length} saved
            </MicroLabel>
          ) : null}
        </View>

        {creatures === null ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : creatures.length === 0 ? (
          <View style={styles.emptyState}>
            {liquid ? (
              <GlassContainer spacing={18} style={styles.emptyGlassContainer}>
                <GlassView style={styles.emptyIconGlass} glassEffectStyle="regular">
                  <Ionicons name="scan" size={32} color={theme.colors.text} />
                </GlassView>
              </GlassContainer>
            ) : (
              <View style={[styles.emptyIconGlass, styles.fallbackCard]}>
                <Ionicons name="scan" size={32} color={theme.colors.text} />
              </View>
            )}
            <Text style={styles.emptyTitle}>Start your collection</Text>
            <Text style={styles.emptyBody}>
              Take a picture, give it a name, and save it here.
            </Text>
          </View>
        ) : (
          <GlassContainer spacing={liquid ? 22 : undefined} style={styles.grid}>
            {creatures.map((creature) => {
              const cardSizeStyle = {
                width: cardWidth,
                minHeight: cardWidth * 1.14,
              }
              const cardContent = (
                <Pressable
                  style={({ pressed }) => [
                    styles.cardContent,
                    pressed && styles.cardPressed,
                  ]}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={creature.commonName}
                >
                  <View
                    style={[
                      styles.photoOrb,
                      {
                        width: cardWidth * 0.66,
                        height: cardWidth * 0.66,
                        borderRadius: cardWidth * 0.33,
                      },
                    ]}
                  >
                    <Image source={{ uri: creature.photoUri }} style={styles.animalImage} />
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
                    {creature.commonName}
                  </Text>
                </Pressable>
              )

              if (liquid) {
                return (
                  <GlassView
                    key={creature.id}
                    style={[styles.card, cardSizeStyle]}
                    glassEffectStyle="regular"
                    tintColor="rgba(255,255,255,0.10)"
                    isInteractive
                  >
                    {cardContent}
                  </GlassView>
                )
              }

              return (
                <View key={creature.id} style={[styles.card, styles.fallbackCard, cardSizeStyle]}>
                  {cardContent}
                </View>
              )
            })}
          </GlassContainer>
        )}
      </View>
    </SafeAreaView>
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
  emptyGlassContainer: {
    alignItems: 'center',
  },
  emptyIconGlass: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
})
