import { ActivityIndicator, DynamicColorIOS, Platform, View } from 'react-native'
import { Redirect } from 'expo-router'
import { usePrivy } from '@privy-io/expo'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { theme } from '@/constants/theme'

/**
 * Tabs are auth-gated. Unauthenticated users are sent back to onboarding.
 * Liquid Glass on iOS 26+ when backgroundColor/blurEffect are left to the system.
 */

const tint = Platform.OS === 'ios' ? DynamicColorIOS({ light: '#111111', dark: '#F5F5F5' }) : '#111111'

const muted =
  Platform.OS === 'ios'
    ? DynamicColorIOS({ light: 'rgba(0,0,0,0.48)', dark: 'rgba(255,255,255,0.55)' })
    : 'rgba(0,0,0,0.48)'

export default function TabLayout() {
  const { isReady, user } = usePrivy()

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.text} />
      </View>
    )
  }

  if (!user) {
    return <Redirect href="/onboarding" />
  }

  return (
    <NativeTabs
      tintColor={tint}
      iconColor={{ default: muted, selected: tint }}
      labelStyle={{
        default: { color: muted, fontSize: 11, fontWeight: '600' },
        selected: { color: tint, fontSize: 11, fontWeight: '700' },
      }}
      minimizeBehavior="onScrollDown"
      disableIndicator
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'sparkles', selected: 'sparkles' }} md="auto_awesome" />
        <NativeTabs.Trigger.Label>Summon</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collection">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="proof">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'checkmark.shield', selected: 'checkmark.shield.fill' }}
          md="verified_user"
        />
        <NativeTabs.Trigger.Label>Proof</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
