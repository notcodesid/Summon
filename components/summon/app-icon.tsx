import { StyleProp, ViewStyle } from 'react-native'
import { SymbolView, type SFSymbol } from 'expo-symbols'
import type { SymbolWeight } from 'expo-symbols'
import { theme } from '@/constants/theme'

type AppIconProps = {
  name: SFSymbol
  size?: number
  color?: string
  style?: StyleProp<ViewStyle>
  weight?: SymbolWeight
}

/**
 * Native SF Symbol icons (no font download from Metro).
 * Avoids @expo/vector-icons / Ionicons.ttf asset errors on device.
 */
export function AppIcon({
  name,
  size = 22,
  color = theme.colors.text,
  style,
  weight = 'medium',
}: AppIconProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={[{ width: size, height: size }, style]}
    />
  )
}
