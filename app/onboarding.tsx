import { useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { AppIcon } from '@/components/summon/app-icon'
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
    copy: 'Each summon will use verifiable randomness so rarity is never a black box.',
  },
  {
    key: 'collect',
    icon: 'square.grid.2x2.fill',
    title: 'Build your collection',
    copy: 'Discover 10 relics across four rarity tiers and inspect every roll on the Proof tab.',
  },
]

export default function OnboardingScreen() {
  const { complete } = useOnboarding()
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList>(null)

  async function finish() {
    await complete()
    router.replace('/(tabs)')
  }

  function next() {
    if (index >= slides.length - 1) {
      void finish()
      return
    }
    const nextIndex = index + 1
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true })
    setIndex(nextIndex)
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== index) setIndex(i)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={() => void finish()} hitSlop={12}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconWrap}>
              <AppIcon name={item.icon} size={40} color={theme.colors.text} weight="semibold" />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.copy}>{item.copy}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={next}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Text style={styles.ctaText}>{index === slides.length - 1 ? 'Enter Summon' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  top: { paddingHorizontal: 24, paddingTop: 8, alignItems: 'flex-end' },
  skip: { color: theme.colors.textMuted, fontSize: 15, fontWeight: '700' },
  slide: {
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
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
  footer: { padding: 24, paddingBottom: 16, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
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
