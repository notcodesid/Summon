import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  ImageBackground,
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
  {
    key: 'auth',
    icon: 'sparkles', // fallback
    title: 'Ready to Summon?',
    copy: 'Sign in to build your collection, verify your pulls on Solana, and claim your relics.',
  },
]

const AUTH_INDEX = slides.length - 1

function OnboardingSlide({ slide, isActive }: { slide: (typeof slides)[number]; isActive: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(20)).current
  const scale = useRef(new Animated.Value(0.5)).current
  const rotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      scale.setValue(0.5)
      opacity.setValue(0)
      translateY.setValue(20)
      rotate.setValue(0)
    }
  }, [isActive, scale, opacity, translateY, rotate])

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-30deg', '0deg'],
  })

  const isLogo = slide.key === 'welcome' || slide.key === 'auth'

  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View
        style={[
          styles.iconWrap,
          {
            opacity,
            transform: [{ scale }, { rotate: spin }],
          },
        ]}
      >
        {isLogo ? (
          <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} tintColor="#000000" />
        ) : (
          <AppIcon name={slide.icon} size={40} color={theme.colors.text} weight="semibold" />
        )}
      </Animated.View>

      <Animated.Text
        style={[
          styles.title,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {slide.title}
      </Animated.Text>

      <Animated.Text
        style={[
          styles.copy,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {slide.copy}
      </Animated.Text>
    </View>
  )
}

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

  return (
    <ImageBackground
      source={require('@/assets/images/onboarding-bg.jpg')}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.45 }}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safe}>
        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={true}
          extraData={index}
          renderItem={({ item, index: itemIndex }) => {
            const isActive = index === itemIndex
            return <OnboardingSlide slide={item} isActive={isActive} />
          }}
        />

        {index < AUTH_INDEX ? (
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={next}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaText}>{index === slides.length - 2 ? 'Continue to sign up' : 'Continue'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.footer}>
            <SocialLoginForm onSuccess={() => void enterApp()} />
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: theme.colors.background },
  safe: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingLabel: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
  slide: {
    paddingHorizontal: 32,
    paddingTop: 80,
    alignItems: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
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
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.8,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  copy: {
    marginTop: 14,
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
    fontWeight: '400',
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  footer: { padding: 24, paddingBottom: 24, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: { backgroundColor: theme.colors.text, width: 22 },
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
