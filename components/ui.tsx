import { useState, type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
import { theme } from '@/constants/theme'

/**
 * Shared primitives. Kept deliberately small — the specimen tag, the one
 * primary action, and the initials avatar. Screens compose their own layout
 * rather than reaching for a component library that does not exist here.
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
      style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed, disabled && styles.primaryDisabled]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={styles.primaryText}>{label}</Text>
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
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
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

const styles = StyleSheet.create({
  micro: {
    fontSize: theme.type.micro.fontSize,
    fontWeight: theme.type.micro.fontWeight,
    letterSpacing: theme.type.micro.letterSpacing,
    textTransform: 'uppercase',
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
