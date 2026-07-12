import { Image, StyleSheet, Text, View } from 'react-native'
import { theme } from '@/constants/theme'

type CollectibleMarkProps = {
  id: string
  mark: string
  accent: string
  size?: number
  locked?: boolean
}

const RELIC_IMAGES: Record<string, any> = {
  'ember-wisp': require('@/assets/images/relic-wisp.jpg'),
  'prism-fang': require('@/assets/images/relic-fang.jpg'),
  'tide-orb': require('@/assets/images/relic-orb.jpg'),
  mossling: require('@/assets/images/relic-mossling.jpg'),
  'dusk-feather': require('@/assets/images/relic-feather.jpg'),
}
const LOCKED_IMAGE = require('@/assets/images/relic-locked.jpg')

/** Monogram badge or custom digital illustration for gacha relics. */
export function CollectibleMark({ id, mark, accent, size = 52, locked }: CollectibleMarkProps) {
  const fontSize = Math.round(size * 0.34)
  const image = locked ? LOCKED_IMAGE : RELIC_IMAGES[id]

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: locked ? theme.colors.surfaceRaised : `${accent}55`,
          overflow: 'hidden',
        },
      ]}
    >
      {image ? (
        <Image source={image} style={{ width: size, height: size, resizeMode: 'cover' }} />
      ) : (
        <Text
          style={{
            color: locked ? theme.colors.textMuted : theme.colors.text,
            fontSize,
            fontWeight: '800',
            letterSpacing: 0.4,
          }}
        >
          {mark}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
