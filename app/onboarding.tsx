import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { usePrivy } from '@privy-io/expo'
import { AppIcon } from '@/components/summon/app-icon'
import { SocialLoginForm } from '@/components/summon/social-login-form'
import { theme } from '@/constants/theme'
import { useOnboarding } from '@/features/onboarding/use-onboarding'
import type { SFSymbol } from 'expo-symbols'

const { width } = Dimensions.get('window')

const slides: { key: string; icon: SFSymbol; title: string; copy: string }[] = [
  {
    key: 'welcome',
    icon: 'sparkles',
    title: 'Welcome to Summon',
    copy: 'A mobile gacha where every pull is fair, fast, and yours on Solana.',
  },
  {
    key: 'fair',
    icon: 'checkmark.shield.fill',
    title: 'Provably fair pulls',
    copy: 'Each summon uses verifiable randomness so rarity is never a black box.',
  },
  {
    key: 'collect',
    icon: 'square.grid.2x2.fill',
    title: 'Build your collection',
    copy: 'Discover 10 relics across four rarity tiers and inspect every roll on the Proof tab.',
  },
]

const AUTH_INDEX = slides.length

/**
 * Onboarding is the only way into the app: product slides → required sign-up.
 * No guest / skip path — Privy session is mandatory before tabs.
 */
export default function OnboardingScreen() {
  const { complete } = useOnboarding()
  const { isReady, user } = usePrivy()
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList>(null)
  const entering = useRef(false)

  async function enterApp() {
    if (entering.current) return
    entering.current = true
    try {
      await complete()
      router.replace('/(tabs)')
    } finally {
      entering.current = false
    }
  }

  // Already signed in (e.g. returning user) → finish and enter
  useEffect(() => {
    if (isReady && user) {
      void enterApp()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to auth readiness
  }, [isReady, user])

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.text} />
        </View>
      </SafeAreaView>
    )
  }

  if (user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.loadingLabel}>Opening Summon…</Text>
        </View>
      </SafeAreaView>
    )
  }

  function next() {
    if (index >= AUTH_INDEX) return
    const nextIndex = index + 1
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true })
    setIndex(nextIndex)
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== index) setIndex(i)
  }

  const pages = [...slides, { key: 'auth' } as const]

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        {index > 0 && index < AUTH_INDEX ? (
          <Pressable
            hitSlop={12}
            onPress={() => {
              const prev = index - 1
              listRef.current?.scrollToIndex({ index: prev, animated: true })
              setIndex(prev)
            }}
          >
            <Text style={styles.backLink}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text style={styles.stepLabel}>
          {index < AUTH_INDEX ? `${index + 1} of ${slides.length}` : 'Sign up'}
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={index < AUTH_INDEX}
        renderItem={({ item }) => {
          if (item.key === 'auth') {
            return (
              <View style={[styles.authSlide, { width }]}>
                <Text style={styles.authTitle}>Create your account</Text>
                <SocialLoginForm onSuccess={() => void enterApp()} />
              </View>
            )
          }

          const slide = item as (typeof slides)[number]
          return (
            <View style={[styles.slide, { width }]}>
              <View style={[styles.iconWrap, slide.key === 'welcome' && styles.iconWrapNoBg]}>
                {slide.key === 'welcome' ? (
                  <Image
                    source={require('@/assets/images/logo-mark.png')}
                    style={styles.logo}
                    tintColor="#000000"
                  />
                ) : (
                  <AppIcon name={slide.icon} size={40} color={theme.colors.text} weight="semibold" />
                )}
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.copy}>{slide.copy}</Text>
            </View>
          )
        }}
      />

      {index < AUTH_INDEX ? (
        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((s, i) => (
              <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
            <View style={[styles.dot, styles.dotAuth]} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>
              {index === slides.length - 1 ? 'Continue to sign up' : 'Continue'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footerHint} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingLabel: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
  top: {
    paddingHorizontal: 24,
    paddingTop: 8,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backLink: { color: theme.colors.textMuted, fontSize: 15, fontWeight: '700' },
  stepLabel: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  slide: {
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
  },
  authSlide: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  iconWrapNoBg: {
    backgroundColor: 'transparent',
  },
  logo: {
    width: 96,
    height: 96,
    resizeMode: 'contain',
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  copy: {
    marginTop: 14,
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  authEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  authTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  authCopy: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  footer: { padding: 24, paddingBottom: 16, gap: 18 },
  footerHint: { paddingHorizontal: 24, paddingBottom: 24 },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: { backgroundColor: theme.colors.text, width: 22 },
  dotAuth: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: theme.colors.text, backgroundColor: 'transparent' },
  cta: {
    minHeight: 56,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.88 },
})

