import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  GlassContainer,
  GlassView,
  isLiquidGlassAvailable,
} from 'expo-glass-effect'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { theme } from '@/constants/theme'

const BAR_MAX_WIDTH = 240

/**
 * Native iOS Liquid Glass tab bar.
 *
 * On iOS 26+, this uses Expo's native wrapper around Apple's UIGlassEffect and
 * UIGlassContainerEffect. There is intentionally no custom selected-background
 * fill, blur, or animated fake glass layer here.
 */
const TABS = [
  { name: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home-sharp' },
  {
    name: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
  },
] as const

/** Routes that take over the whole screen and hide the bar. */
const FULL_SCREEN = ['camera', 'reveal']

type NavTab = (typeof TABS)[number]

export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const activeName = state.routes[state.index]?.name

  if (FULL_SCREEN.includes(activeName)) return null

  const liquid = isLiquidGlassAvailable()
  const showScan = activeName !== 'profile' && activeName !== 'collection'
  const barWidth = Math.min(width - theme.space.lg * 2, BAR_MAX_WIDTH)

  const renderTab = (tab: NavTab) => {
    const focused = activeName === tab.name
    const color = focused ? theme.colors.text : theme.colors.textMuted
    const content = (
      <Pressable
        onPress={() => {
          if (!focused) navigation.navigate(tab.name)
        }}
        style={({ pressed }) => [
          styles.tab,
          focused && !liquid && styles.tabFallbackActive,
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

    if (!liquid || !focused) {
      return <View key={tab.name}>{content}</View>
    }

    return (
      <GlassView
        key={tab.name}
        style={styles.activeTabGlass}
        glassEffectStyle="regular"
        isInteractive
      >
        {content}
      </GlassView>
    )
  }

  const tabs = TABS.map(renderTab)

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
              <GlassView style={styles.scanGlass} glassEffectStyle="regular" isInteractive>
                {scanButton}
              </GlassView>
            </GlassContainer>
          ) : (
            <View style={[styles.scanGlass, styles.fallbackSurface]}>{scanButton}</View>
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
            <View style={[styles.bar, styles.fallbackSurface]}>{tabs}</View>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  controlsStack: {
    alignItems: 'center',
    gap: theme.space.lg,
  },
  controlsGlassContainer: {
    alignItems: 'center',
  },
  glassStack: {
    height: 58,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  fallbackSurface: {
    backgroundColor: theme.colors.glassSurfaceStrong,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  activeTabGlass: {
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  tabFallbackActive: {
    backgroundColor: theme.colors.glassSurfaceStrong,
  },
  tab: {
    minWidth: 104,
    minHeight: 46,
    paddingVertical: 6,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabPressed: {
    opacity: 0.6,
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
