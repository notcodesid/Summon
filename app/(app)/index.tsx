import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { router } from 'expo-router'
import { theme } from '@/constants/theme'
import { animalImageAt } from '@/lib/animal-images'

/**
 * Home reads as the front page of a field guide: what you've collected, your
 * rarest find, your latest catches, and one way forward.
 */
export default function HomeScreen() {
  return <Home />
}

type MockAnimal = {
  name: string
  handle: string
  color: string
  darkColor: string
  image?: ImageSourcePropType
}

const MOCK_ANIMALS: MockAnimal[] = [
  {
    name: 'Scout dog',
    handle: 'common',
    color: '#7C5A3B',
    darkColor: '#C69A6D',
    image: animalImageAt(0),
  },
  {
    name: 'Moon cat',
    handle: 'rare',
    color: '#256C8E',
    darkColor: '#6DB9D8',
    image: animalImageAt(1),
  },
  {
    name: 'River fish',
    handle: 'aquatic',
    color: '#17446D',
    darkColor: '#78AEE2',
    image: animalImageAt(2),
  },
]

function Home() {
  const { width } = useWindowDimensions()
  const colorScheme = useColorScheme()
  const cardGap = theme.space.md
  const cardWidth = Math.min(
    180,
    Math.floor((width - theme.space.xl * 2 - cardGap) / 2),
  )
  const liquid = isLiquidGlassAvailable()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.masthead}>
          <Text style={styles.wordmark}>Home</Text>
        </View>

        <GlassContainer
          spacing={liquid ? 22 : undefined}
          style={styles.mockGrid}
        >
          {MOCK_ANIMALS.map((animal) => {
            const accent = colorScheme === 'dark' ? animal.darkColor : animal.color
            const cardSizeStyle = {
              width: cardWidth,
              minHeight: cardWidth * 1.14,
            }
            const cardContent = (
              <Pressable
                onPress={() => router.push('/collection')}
                style={({ pressed }) => [
                  styles.mockCardContent,
                  pressed && styles.mockCardPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={animal.name}
              >
                <View
                  style={[
                    styles.animalOrb,
                    {
                      width: cardWidth * 0.62,
                      height: cardWidth * 0.62,
                      borderRadius: cardWidth * 0.31,
                      backgroundColor: accent,
                    },
                  ]}
                >
                  {animal.image ? (
                    <Image source={animal.image} style={styles.animalImage} />
                  ) : null}
                  {liquid ? (
                    <GlassView
                      pointerEvents="none"
                      style={styles.animalOrbGlass}
                      glassEffectStyle="clear"
                      tintColor="rgba(255,255,255,0.18)"
                    />
                  ) : null}
                  <View pointerEvents="none" style={styles.animalOrbShade} />
                  <View pointerEvents="none" style={styles.animalOrbRim} />
                  <View pointerEvents="none" style={styles.animalOrbHighlight} />
                  <View pointerEvents="none" style={styles.animalOrbGlint} />
                </View>
                <Text style={[styles.mockCardTitle, { color: accent }]}>
                  {animal.name}
                </Text>
              </Pressable>
            )

            if (liquid) {
              return (
                <GlassView
                  key={animal.name}
                  style={[styles.mockCard, cardSizeStyle]}
                  glassEffectStyle="regular"
                  tintColor="rgba(255,255,255,0.10)"
                  isInteractive
                >
                  {cardContent}
                </GlassView>
              )
            }

            return (
              <View
                key={animal.name}
                style={[styles.mockCard, styles.mockCardFallback, cardSizeStyle]}
              >
                {cardContent}
              </View>
            )
          })}
        </GlassContainer>
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
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: theme.colors.text,
  },

  mockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
    paddingTop: theme.space.xl,
  },
  mockCard: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
  },
  mockCardFallback: {
    borderWidth: 1,
    borderColor: theme.colors.rule,
    backgroundColor: theme.colors.background,
  },
  mockCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.md,
  },
  mockCardPressed: {
    opacity: 0.72,
  },
  animalOrb: {
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
  animalOrbGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
  },
  animalOrbShade: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  animalOrbRim: {
    position: 'absolute',
    top: 3,
    left: 4,
    right: 4,
    height: '42%',
    borderTopWidth: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    borderRadius: theme.radius.pill,
    opacity: 0.82,
  },
  animalOrbHighlight: {
    position: 'absolute',
    top: 8,
    left: 10,
    width: '45%',
    height: '20%',
    borderTopWidth: 3,
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: theme.radius.pill,
    transform: [{ rotate: '-20deg' }],
  },
  animalOrbGlint: {
    position: 'absolute',
    top: 16,
    left: 19,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  mockCardTitle: {
    marginTop: theme.space.lg,
    textAlign: 'center',
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
})
