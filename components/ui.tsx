import { useState, type ReactNode } from 'react'
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '@/constants/theme'

/**
 * Shared primitives for the field-guide layout: specimen tags, hairline rules,
 * label/value rows, and the single primary action.
 */

/** Uppercase tracked micro-label. The specimen tag of this design. */
export function MicroLabel({
  children,
  color = theme.colors.textFaint,
  style,
}: {
  children: ReactNode
  color?: string
  style?: StyleProp<TextStyle>
}) {
  return <Text style={[styles.micro, { color }, style]}>{children}</Text>
}

/** Hairline divider. Structure without a box. */
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.rule, style]} />
}

/** Left-aligned label, right-aligned value, separated by a hairline. */
export function DataRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <View style={styles.dataRow}>
      <MicroLabel>{label}</MicroLabel>
      <Text style={[styles.dataValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
  )
}

/** Screen header: back chevron, centered title, balanced spacer. */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
        ) : null}
      </View>
      <MicroLabel color={theme.colors.text}>{title}</MicroLabel>
      <View style={styles.headerSide}>{right}</View>
    </View>
  )
}

/** The one primary action on a surface. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.primaryPressed,
        disabled && styles.primaryDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  )
}

/** Quiet text action, for the secondary path. */
export function QuietButton({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {({ pressed }) => (
        <Text style={[styles.quiet, pressed && styles.quietPressed]}>{label}</Text>
      )}
    </Pressable>
  )
}

/**
 * Initials avatar. Privy's Google accounts carry no profile picture, so this
 * is drawn rather than loaded — it can never fail to render.
 */
export function Avatar({
  initials,
  uri,
  size = 40,
  onPress,
  accessibilityLabel,
}: {
  initials: string
  /** Profile photo. Falls back to initials when absent or it fails to load. */
  uri?: string | null
  size?: number
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const [failed, setFailed] = useState(false)
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  }

  const showPhoto = Boolean(uri) && !failed

  const face = showPhoto ? (
    <Image
      source={{ uri: uri as string }}
      style={[styles.avatarImage, circle]}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={[styles.avatar, circle]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>
        {initials}
      </Text>
    </View>
  )

  if (!onPress) return face

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Open profile'}
      style={({ pressed }) => (pressed ? styles.avatarPressed : undefined)}
    >
      {face}
    </Pressable>
  )
}

/** Small filled dot — rarity as a mark rather than a filled pill. */
export function RarityDot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />
}

const styles = StyleSheet.create({
  micro: {
    fontSize: theme.type.micro.fontSize,
    fontWeight: theme.type.micro.fontWeight,
    letterSpacing: theme.type.micro.letterSpacing,
    textTransform: 'uppercase',
  },
  rule: {
    height: 1,
    backgroundColor: theme.colors.rule,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.rule,
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  headerSide: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.primary,
    minHeight: 54,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxl,
  },
  primaryPressed: {
    opacity: 0.86,
  },
  primaryDisabled: {
    opacity: 0.4,
  },
  primaryText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quiet: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  quietPressed: {
    opacity: 0.6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  avatar: {
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    backgroundColor: theme.colors.surfaceRaised,
  },
  avatarText: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  avatarPressed: {
    opacity: 0.8,
  },
})
