import { useCallback, useEffect, useMemo, useState } from 'react'
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

function shortAddress(address?: string | null) {
  if (!address) return 'creating wallet…'
  if (address.length <= 14) return address
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

/** Account screen: identity, collection progress, wallet, and sign out. */
export default function ProfileScreen() {
  const { logout } = usePrivy()
  const player = usePlayer()
  const { photoUrl, refresh } = usePlayerPhoto(player.privyUserId)
  const avatarUrl = photoUrl ?? player.googlePhotoUrl
  const [caught, setCaught] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const liquid = isLiquidGlassAvailable()
  const walletDisplay = useMemo(
    () => shortAddress(player.walletAddress),
    [player.walletAddress],
  )

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

  const onOpenCollection = useCallback(() => {
    router.push('/collection')
  }, [])

  const onSignOut = useCallback(() => {
    void logout().then(() => router.replace('/login'))
  }, [logout])

  const profileCard = (
    <View style={styles.profileContent}>
      <View style={styles.avatarPicker}>
        <Avatar
          initials={initialsFor(player)}
          uri={avatarUrl}
          size={92}
          onPress={onChoosePhoto}
          accessibilityLabel="Change profile picture"
        />
        <View style={styles.avatarBadge} pointerEvents="none">
          {savingPhoto ? (
            <ActivityIndicator size="small" color={theme.colors.onPrimary} />
          ) : (
            <Ionicons name="camera" size={14} color={theme.colors.onPrimary} />
          )}
        </View>
      </View>

      <View style={styles.identityText}>
        {player.name ? <Text style={styles.name}>{player.name}</Text> : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Ionicons name="paw" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{caught ?? '—'}</Text>
        </View>
      </View>
    </View>
  )

  const walletCard = (
    <View style={styles.walletContent}>
      <View style={styles.walletAddressRow}>
        <View style={styles.walletIcon}>
          <Ionicons name="wallet-outline" size={18} color={theme.colors.text} />
        </View>
        <Text style={styles.address} selectable>
          {walletDisplay}
        </Text>
        {player.walletAddress ? (
          <Pressable
            onPress={onCopy}
            style={({ pressed }) => [styles.copyIconButton, pressed && styles.copyButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Copy wallet address"
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={17}
              color={theme.colors.text}
            />
          </Pressable>
        ) : null}
      </View>

    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Profile</Text>
        <MicroLabel color={theme.colors.textMuted}>{caught ?? '—'} saved</MicroLabel>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {liquid ? (
          <GlassContainer spacing={18} style={styles.stack}>
            <GlassView style={styles.profileCard} glassEffectStyle="regular">
              {profileCard}
            </GlassView>
            <GlassView style={styles.walletCard} glassEffectStyle="regular">
              {walletCard}
            </GlassView>
          </GlassContainer>
        ) : (
          <View style={styles.stack}>
            <View style={[styles.profileCard, styles.fallbackCard]}>{profileCard}</View>
            <View style={[styles.walletCard, styles.fallbackCard]}>{walletCard}</View>
          </View>
        )}

        <Pressable
          onPress={onOpenCollection}
          style={({ pressed }) => [styles.collectionButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Open collection"
        >
          <View style={styles.collectionIcon}>
            <Ionicons name="images-outline" size={18} color={theme.colors.text} />
          </View>
          <Text style={styles.collectionTitle}>collection</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Pressable>

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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.xl,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: theme.colors.text,
  },
  scroll: {
    paddingHorizontal: theme.space.xl,
    paddingBottom: 132,
  },
  stack: {
    gap: theme.space.md,
  },
  profileCard: {
    borderRadius: 32,
    overflow: 'hidden',
    paddingVertical: 34,
    paddingHorizontal: theme.space.lg,
  },
  fallbackCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  profileContent: {
    alignItems: 'center',
  },
  avatarPicker: {
    position: 'relative',
    width: 98,
    height: 98,
    justifyContent: 'center',
    marginBottom: theme.space.lg,
  },
  avatarBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.text,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  identityText: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: theme.colors.text,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.lg,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  walletCard: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: theme.space.md,
  },
  walletContent: {
    gap: theme.space.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletAddressRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  walletIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  address: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: theme.colors.text,
  },
  copyIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  copyButtonPressed: {
    opacity: 0.7,
  },
  collectionButton: {
    marginTop: theme.space.lg,
    minHeight: 64,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.md,
  },
  collectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  collectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  buttonPressed: {
    opacity: 0.72,
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
