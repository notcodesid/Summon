import { Tabs } from 'expo-router'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TAB_ICONS: Record<string, { activeIcon: keyof typeof Ionicons.glyphMap; inactiveIcon: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: {
    activeIcon: 'leaf',
    inactiveIcon: 'leaf-outline',
    label: 'Explore',
  },
  profile: {
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
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
    activeIcon: 'square',
    inactiveIcon: 'square-outline',
    label: route.name,
  }

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    onPress()
  }

  const iconName = isFocused ? itemConfig.activeIcon : itemConfig.inactiveIcon
  const iconColor = isFocused ? '#B7F34A' : '#9CA69D'

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
        <Ionicons name={iconName} size={24} color={iconColor} />
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
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
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
    backgroundColor: 'rgba(24, 32, 25, 0.94)',
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
    borderColor: 'rgba(183, 243, 74, 0.25)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    width: 36,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  labelActive: {
    color: '#B7F34A',
    fontWeight: '800',
  },
  labelInactive: {
    color: '#9CA69D',
  },
})


