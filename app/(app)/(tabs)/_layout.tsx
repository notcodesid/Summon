import { Tabs } from 'expo-router'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TAB_ICONS: Record<string, { icon: any; label: string; badge?: number }> = {
  index: {
    icon: require('@/assets/tab-icons-transparent/home.png'),
    label: 'Home',
  },
  profile: {
    icon: require('@/assets/tab-icons-transparent/profile.png'),
    label: 'Profile',
  },
}

function AnimatedTabItem({
  route,
  isFocused,
  options,
  onPress,
  onLongPress,
}: {
  route: any
  isFocused: boolean
  options: any
  onPress: () => void
  onLongPress: () => void
}) {
  const itemConfig = TAB_ICONS[route.name] || {
    icon: require('@/assets/tab-icons-transparent/home.png'),
    label: route.name,
  }

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    onPress()
  }

  return (
    <Pressable
      key={route.key}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      testID={options.tabBarTestID}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tabItem}
    >
      <View style={styles.iconContainer}>
        <Image
          source={itemConfig.icon}
          style={[styles.stickerIcon, isFocused ? styles.stickerIconActive : null]}
          contentFit="contain"
        />
        {itemConfig.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemConfig.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]}>
        {itemConfig.label}
      </Text>
    </Pressable>
  )
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabBarContainer}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key]
          const isFocused = state.index === index

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params)
            }
          }

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            })
          }

          return (
            <AnimatedTabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              options={options}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          )
        })}
      </View>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 36,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stickerIcon: {
    width: 38,
    height: 38,
  },
  stickerIconActive: {
    width: 48,
    height: 48,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  badgeText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '900',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.2,
  },
  labelActive: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  labelInactive: {
    color: '#94A3B8',
  },
})


