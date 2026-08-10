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
  collection: {
    icon: require('@/assets/tab-icons-transparent/collection.png'),
    label: 'Collection',
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
      <Tabs.Screen name="collection" options={{ title: 'Collection' }} />
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
    backgroundColor: '#61B6A9',
    borderRadius: 36,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
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
    backgroundColor: '#FF5A5F',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.2,
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  labelInactive: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
})


