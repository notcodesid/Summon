import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { theme } from '@/constants/theme'

/**
 * Use the platform tab bar instead of drawing a glass surface in React.
 * On iOS 26+, UIKit supplies Liquid Glass, selection morphing, scroll-edge
 * behavior, accessibility, and safe-area adaptation automatically.
 */
export default function TabsLayout() {
  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={theme.colors.text}
      iconColor={{
        default: theme.colors.textMuted,
        selected: theme.colors.text,
      }}
      labelStyle={{
        default: {
          color: theme.colors.textMuted,
          fontSize: 11,
          fontWeight: '600',
        },
        selected: {
          color: theme.colors.text,
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collection">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.stack', selected: 'square.stack.fill' }} md="collections" />
        <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
