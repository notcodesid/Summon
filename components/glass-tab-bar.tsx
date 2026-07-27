import { useEffect, useRef } from 'react'
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  GlassContainer,
  GlassView,
  isLiquidGlassAvailable,
} from 'expo-glass-effect'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { theme } from '@/constants/theme'

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView)

const BAR_MAX_WIDTH = 240
const BAR_PADDING = 8
const TAB_COUNT = 2

/**
 * Floating tab bar using Apple's Liquid Glass material.
 *
 * `isLiquidGlassAvailable()` is false below iOS 26, where GlassView renders as
 * a plain view — so the fallback branch supplies a solid surface rather than
 * letting the bar turn invisible over scrolled content.
 */
const LEFT_TABS = [
  { name: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home-sharp' },
] as const

const RIGHT_TABS = [
  {
    name: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
  },
] as const

const NAV_TABS = [...LEFT_TABS, ...RIGHT_TABS] as const

/** Routes that take over the whole screen and hide the bar. */
const FULL_SCREEN = ['camera', 'reveal']

type NavTab = (typeof NAV_TABS)[number]

export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const activeName = state.routes[state.index]?.name

  const liquid = isLiquidGlassAvailable()
  const barWidth = Math.min(width - theme.space.lg * 2, BAR_MAX_WIDTH)
  const tabWidth = (barWidth - BAR_PADDING * 2) / TAB_COUNT
  const activeIndex = Math.max(
    0,
    NAV_TABS.findIndex((tab) => tab.name === activeName),
  )
  const activeLeft = BAR_PADDING + activeIndex * tabWidth
  const activeX = useRef(new Animated.Value(activeLeft)).current

  useEffect(() => {
    Animated.spring(activeX, {
      toValue: activeLeft,
      useNativeDriver: false,
      damping: 18,
      stiffness: 190,
      mass: 0.65,
    }).start()
  }, [activeLeft, activeX])

  if (FULL_SCREEN.includes(activeName)) return null

  const showScan = activeName !== 'profile'

  const renderTab = (tab: NavTab) => {
    const focused = activeName === tab.name
    const color = focused ? theme.colors.text : theme.colors.textMuted

    return (
      <Pressable
        key={tab.name}
        onPress={() => {
          if (!focused) navigation.navigate(tab.name)
        }}
        style={({ pressed }) => [
          styles.tab,
          { width: tabWidth },
          pressed && styles.tabPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
      >
        <Ionicons
          name={focused ? tab.activeIcon : tab.icon}
          size={22}
          color={color}
        />
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {tab.label}
        </Text>
      </Pressable>
    )
  }

  const activeIndicator = liquid ? (
    <AnimatedGlassView
      pointerEvents="none"
      style={[
        styles.activeGlass,
        { width: tabWidth, transform: [{ translateX: activeX }] },
      ]}
      glassEffectStyle="regular"
      tintColor="rgba(255,255,255,0.30)"
      isInteractive
    />
  ) : (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.activeGlass,
        styles.activeFallback,
        { width: tabWidth, transform: [{ translateX: activeX }] },
      ]}
    />
  )

  const tabs = (
    <>
      {activeIndicator}
      <View style={styles.tabCluster}>{LEFT_TABS.map(renderTab)}</View>
      <View style={styles.tabCluster}>{RIGHT_TABS.map(renderTab)}</View>
    </>
  )

  const scanButton = (
    <Pressable
      onPress={() => navigation.navigate('camera')}
      style={({ pressed }) => [styles.scanButton, pressed && styles.scanPressed]}
      accessibilityRole="button"
      accessibilityLabel="Open camera to scan an animal"
    >
      <Ionicons name="scan" size={32} color={theme.colors.text} />
    </Pressable>
  )

  return (
    <View
      style={[styles.slot, { paddingBottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
    >
      <View style={styles.controlsStack}>
        {showScan ? (
          liquid ? (
            <GlassContainer spacing={18} style={styles.controlsGlassContainer}>
              <GlassView
                style={styles.scanGlass}
                glassEffectStyle="regular"
                tintColor="rgba(255,255,255,0.18)"
                isInteractive
              >
                {scanButton}
              </GlassView>
            </GlassContainer>
          ) : (
            <View style={[styles.scanGlass, styles.barFallback]}>{scanButton}</View>
          )
        ) : null}

        {liquid ? (
          <GlassContainer spacing={18} style={[styles.glassStack, { width: barWidth }]}>
            <GlassView style={styles.bar} glassEffectStyle="regular">
              {tabs}
            </GlassView>
          </GlassContainer>
        ) : (
          <View style={[styles.glassStack, { width: barWidth }]}>
            <View style={[styles.bar, styles.barFallback]}>{tabs}</View>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    paddingTop: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    backgroundColor: 'transparent',
  },
  controlsStack: {
    alignItems: 'center',
    gap: theme.space.lg,
  },
  controlsGlassContainer: {
    alignItems: 'center',
  },
  glassStack: {
    position: 'relative',
    height: 58,
    alignItems: 'center',
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: BAR_PADDING,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  /** Pre-iOS 26: GlassView is inert, so give the bar a real surface. */
  barFallback: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    minHeight: 46,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    zIndex: 1,
  },
  tabPressed: {
    opacity: 0.6,
  },
  activeGlass: {
    position: 'absolute',
    left: 0,
    top: 7,
    bottom: 7,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  activeFallback: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  scanGlass: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: 'hidden',
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  scanButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanPressed: {
    opacity: 0.68,
  },
})
