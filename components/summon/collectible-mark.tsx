import { StyleSheet, Text, View } from 'react-native'
import { theme } from '@/constants/theme'

type CollectibleMarkProps = {
  mark: string
  accent: string
  size?: number
  locked?: boolean
}

/** Monogram badge — no emoji. */
export function CollectibleMark({ mark, accent, size = 52, locked }: CollectibleMarkProps) {
  const fontSize = Math.round(size * 0.34)
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: locked ? theme.colors.surfaceRaised : `${accent}55`,
        },
      ]}
    >
      <Text
        style={{
          color: locked ? theme.colors.textMuted : theme.colors.text,
          fontSize,
          fontWeight: '800',
          letterSpacing: 0.4,
        }}
      >
        {locked ? '?' : mark}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
