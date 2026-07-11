import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { theme } from '@/constants/theme'

/**
 * Light liquid-glass tab bar (iOS 26+ system materials).
 * @see https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
 *
 * Forces *Light* material variants so the bar never follows dark system theme.
 * Icons are SF Symbols — no emoji, no vector-icon font downloads.
 */
export default function TabLayout() {
  return (
    <NativeTabs
      // Opaque-enough light frosted glass (not black)
      backgroundColor="rgba(252, 252, 251, 0.82)"
      blurEffect="systemChromeMaterialLight"
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
      tintColor={theme.colors.text}
      shadowColor="rgba(0,0,0,0.08)"
      minimizeBehavior="onScrollDown"
      disableTransparentOnScrollEdge
      disableIndicator
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'sparkles', selected: 'sparkles' }}
          md="auto_awesome"
        />
        <NativeTabs.Trigger.Label>Summon</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collection">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
          md="grid_view"
        />
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
