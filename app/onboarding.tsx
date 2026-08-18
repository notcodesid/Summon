import { useCallback, useRef, useState } from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn } from 'react-native-reanimated'
import { theme } from '@/constants/theme'
import { markOnboardingSeen } from '@/lib/onboarding'

/**
 * Pre-login intro. Three story beats, then hand off to sign-in.
 *
 * The fourth beat — the guided first scan — deliberately lives *after* auth,
 * because identify requires a Privy access token.
 */
type Slide = {
  key: string
  title: string
  body: string
  /** Metro resolves `require` of a bundled asset to an opaque numeric id. */
  art: number
}

const SLIDES: Slide[] = [
  {
    key: 'real',
    title: 'Real animals, real world.',
    body: 'Every creature you own is one you actually found. Nothing is invented, and nothing is handed to you.',
    art: require('@/assets/onboarding-greeting.png'),
  },
  {
    key: 'scan',
    title: 'Point, scan, keep.',
    body: 'Photograph an animal and Summon identifies it, then turns it into a creature with its own rarity and stats.',
    art: require('@/assets/onboarding-scan.png'),
  },
  {
    key: 'outside',
    title: 'They only live outside.',
    body: 'Nothing appears in your living room. Go for a walk — your collection grows at the speed you explore.',
    art: require('@/assets/onboarding-outside.png'),
  },
]

export default function OnboardingScreen() {
  const { width } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)
  const [index, setIndex] = useState(0)
  const isLast = index === SLIDES.length - 1

  // Await the write before navigating: login reads this flag on mount and would
  // redirect straight back here if the read beat the write.
  const finish = useCallback(async () => {
    await markOnboardingSeen()
    router.replace('/login')
  }, [])

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width)
      if (next !== index) {
        setIndex(next)
        void Haptics.selectionAsync()
      }
    },
    [index, width],
  )

  const onNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (isLast) {
      void finish()
      return
    }
    const next = index + 1
    scrollRef.current?.scrollTo({ x: next * width, animated: true })
    setIndex(next)
  }, [finish, index, isLast, width])

  return (
    <View style={styles.root}>
      <View style={styles.groundLayer} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.skipRow}>
          {!isLast ? (
            <Pressable
              onPress={() => void finish()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip intro"
            >
              <Text style={styles.skip}>skip</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.pager}
        >
          {SLIDES.map((slide) => (
            <View key={slide.key} style={[styles.slide, { width }]}>
              <Image source={slide.art} style={styles.art} contentFit="contain" />
              <View style={styles.copy}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.body}>{slide.body}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((slide, i) => (
              <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          <Animated.View entering={FadeIn.duration(320)}>
            <Pressable
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Get started' : 'Next'}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaText}>{isLast ? 'get started' : 'next'}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.viewfinder,
  },
  groundLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38%',
    backgroundColor: '#141C16',
  },
  safe: {
    flex: 1,
  },
  skipRow: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: theme.space.xl,
  },
  skip: {
    color: theme.colors.textFaint,
    fontSize: 15,
    fontWeight: '600',
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.space.xl,
  },
  art: {
    flex: 1,
    width: '82%',
    marginBottom: theme.space.lg,
  },
  copy: {
    alignItems: 'center',
    gap: theme.space.md,
    paddingBottom: theme.space.xl,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: theme.colors.onDark,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: theme.colors.textFaint,
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: theme.space.xl,
    paddingBottom: theme.space.xl,
    gap: theme.space.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.space.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 242, 233, 0.22)',
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 22,
  },
  cta: {
    minHeight: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
})
