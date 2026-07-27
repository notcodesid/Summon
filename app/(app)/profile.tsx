import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Clipboard from '@react-native-clipboard/clipboard'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router, useFocusEffect } from 'expo-router'
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { usePrivy } from '@privy-io/expo'
import { theme } from '@/constants/theme'
import { Avatar, MicroLabel } from '@/components/ui'
import { loadCollection } from '@/lib/collection'
import { savePlayerPhoto, usePlayerPhoto } from '@/lib/player-photo'
import { initialsFor, usePlayer } from '@/lib/use-player'

/**
 * Account screen. Explains what the wallet is, since it appears without the
 * player ever asking for one, and holds sign out.
 */
export default function ProfileScreen() {
  const { logout } = usePrivy()
  const player = usePlayer()
  const { photoUrl, refresh } = usePlayerPhoto(player.privyUserId)
  const avatarUrl = photoUrl ?? player.googlePhotoUrl
  const [caught, setCaught] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const liquid = isLiquidGlassAvailable()

  useFocusEffect(
    useCallback(() => {
      let active = true
      void loadCollection(player.privyUserId).then((next) => {
        if (active) setCaught(next.length)
      })
      return () => {
        active = false
      }
    }, [player.privyUserId]),
  )

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const onCopy = useCallback(() => {
    if (!player.walletAddress) return
    Clipboard.setString(player.walletAddress)
    setCopied(true)
  }, [player.walletAddress])

  const onChoosePhoto = useCallback(async () => {
    if (savingPhoto) return
    if (!player.privyUserId) {
      Alert.alert('Still signing in', 'Try again once your profile finishes loading.')
      return
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to upload a profile picture.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.55,
      base64: true,
    })

    if (result.canceled) return

    const asset = result.assets[0]
    if (!asset?.base64) {
      Alert.alert('Could not use that photo', 'Please choose another image.')
      return
    }

    setSavingPhoto(true)
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg'
      const saved = await savePlayerPhoto(
        player.privyUserId,
        `data:${mimeType};base64,${asset.base64}`,
        'upload',
      )
      if (saved) {
        await refresh()
      } else {
        Alert.alert('Upload failed', 'Please try again in a moment.')
      }
    } finally {
      setSavingPhoto(false)
    }
  }, [player.privyUserId, refresh, savingPhoto])

  const onSignOut = useCallback(() => {
    void logout().then(() => router.replace('/login'))
  }, [logout])

  const heroContent = (
    <View style={styles.identity}>
      <View style={styles.avatarPicker}>
        <Avatar
          initials={initialsFor(player)}
          uri={avatarUrl}
          size={78}
          onPress={onChoosePhoto}
          accessibilityLabel="Change profile picture"
        />
        <View style={styles.avatarBadge} pointerEvents="none">
          {savingPhoto ? (
            <ActivityIndicator size="small" color={theme.colors.onDark} />
          ) : (
            <Ionicons name="camera" size={14} color={theme.colors.onDark} />
          )}
        </View>
      </View>
      <View style={styles.identityText}>
        <MicroLabel color={theme.colors.textFaint}>signed in with google</MicroLabel>
        {player.name ? <Text style={styles.name}>{player.name}</Text> : null}
        {player.email ? (
          <Text style={[styles.email, !player.name && styles.emailAlone]}>
            {player.email}
          </Text>
        ) : null}
      </View>
    </View>
  )

  const statsContent = (
    <View style={styles.statsRow}>
      <View>
        <MicroLabel>species collected</MicroLabel>
        <Text style={styles.bigValue}>{caught ?? '—'}</Text>
      </View>
      <View style={styles.statIcon}>
        <Ionicons name="paw" size={22} color={theme.colors.text} />
      </View>
    </View>
  )

  const walletContent = (
    <View style={styles.walletContent}>
      <View style={styles.cardHeaderRow}>
        <MicroLabel>solana wallet</MicroLabel>
        <Ionicons name="wallet-outline" size={18} color={theme.colors.textFaint} />
      </View>
      <Text style={styles.address} selectable>
        {player.walletAddress ?? 'creating your wallet…'}
      </Text>
      <Text style={styles.explainer}>
        This wallet is created for your animals. You do not need to manage it yet.
      </Text>
      {player.walletAddress ? (
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Copy wallet address"
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={15}
            color={theme.colors.text}
          />
          <Text style={styles.copyText}>{copied ? 'copied' : 'copy address'}</Text>
        </Pressable>
      ) : null}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <MicroLabel color={theme.colors.text}>profile</MicroLabel>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {liquid ? (
          <GlassContainer spacing={18} style={styles.stack}>
            <GlassView style={styles.heroCard} glassEffectStyle="regular">
              {heroContent}
            </GlassView>
            <GlassView style={styles.statCard} glassEffectStyle="regular">
              {statsContent}
            </GlassView>
            <GlassView style={styles.walletCard} glassEffectStyle="regular">
              {walletContent}
            </GlassView>
          </GlassContainer>
        ) : (
          <View style={styles.stack}>
            <View style={[styles.heroCard, styles.fallbackCard]}>{heroContent}</View>
            <View style={[styles.statCard, styles.fallbackCard]}>{statsContent}</View>
            <View style={[styles.walletCard, styles.fallbackCard]}>{walletContent}</View>
          </View>
        )}

        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.space.md,
    paddingBottom: theme.space.lg,
  },
  scroll: {
    paddingHorizontal: theme.space.xl,
    paddingBottom: 148,
  },
  stack: {
    gap: theme.space.md,
  },
  heroCard: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    padding: theme.space.lg,
  },
  fallbackCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
  },
  avatarPicker: {
    position: 'relative',
    width: 84,
    height: 84,
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.text,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  identityText: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: theme.colors.text,
  },
  email: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  emailAlone: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statCard: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    padding: theme.space.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigValue: {
    marginTop: theme.space.xs,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  walletCard: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    padding: theme.space.lg,
  },
  walletContent: {
    gap: theme.space.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  address: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 22,
  },
  explainer: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textMuted,
  },
  copyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  copyButtonPressed: {
    opacity: 0.7,
  },
  copyText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  signOut: {
    marginTop: theme.space.lg,
    minHeight: 52,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  signOutPressed: {
    backgroundColor: theme.colors.surface,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
})
