import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Clipboard from '@react-native-clipboard/clipboard'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { usePrivy } from '@privy-io/expo'
import { theme } from '@/constants/theme'
import { Avatar, MicroLabel, Rule } from '@/components/ui'
import { loadCollection } from '@/lib/collection'
import { usePlayerPhoto } from '@/lib/player-photo'
import { initialsFor, usePlayer } from '@/lib/use-player'

/**
 * Account screen. Explains what the wallet is, since it appears without the
 * player ever asking for one, and holds sign out.
 */
export default function ProfileScreen() {
  const { logout } = usePrivy()
  const player = usePlayer()
  const { photoUrl } = usePlayerPhoto(player.privyUserId)
  const [caught, setCaught] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

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

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  const onCopy = useCallback(() => {
    if (!player.walletAddress) return
    Clipboard.setString(player.walletAddress)
    setCopied(true)
  }, [player.walletAddress])

  const onSignOut = useCallback(() => {
    void logout().then(() => router.replace('/login'))
  }, [logout])

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <MicroLabel color={theme.colors.text}>profile</MicroLabel>
        <View style={styles.headerSpacer} />
      </View>
      <Rule />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.identity}>
          <Avatar initials={initialsFor(player)} uri={photoUrl} size={72} />
          <View style={styles.identityText}>
            {player.name ? (
              <Text style={styles.name}>{player.name}</Text>
            ) : null}
            {player.email ? (
              <Text style={[styles.email, !player.name && styles.emailAlone]}>
                {player.email}
              </Text>
            ) : null}
            <Text style={styles.signedInWith}>signed in with google</Text>
          </View>
        </View>

        <Rule />

        <View style={styles.section}>
          <MicroLabel>species collected</MicroLabel>
          <Text style={styles.bigValue}>{caught ?? '—'}</Text>
        </View>

        <Rule />

        <View style={styles.section}>
          <MicroLabel>your solana wallet</MicroLabel>
          <Text style={styles.address} selectable>
            {player.walletAddress ?? 'creating your wallet…'}
          </Text>
          <Text style={styles.explainer}>
            Summon made this wallet for you when you signed in. You don&apos;t
            need to do anything with it yet — it&apos;s where your animals will
            live once trading and battles arrive.
          </Text>
          {player.walletAddress ? (
            <Pressable
              onPress={onCopy}
              style={({ pressed }) => [
                styles.copyButton,
                pressed && styles.copyButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Copy wallet address"
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={15}
                color={theme.colors.text}
              />
              <Text style={styles.copyText}>
                {copied ? 'copied' : 'copy address'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Rule />

        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.signOut,
            pressed && styles.signOutPressed,
          ]}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scroll: {
    paddingHorizontal: theme.space.xl,
    paddingBottom: theme.space.section,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
    paddingVertical: theme.space.xl,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
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
  signedInWith: {
    marginTop: theme.space.xs,
    fontSize: 12,
    color: theme.colors.textFaint,
  },
  section: {
    paddingVertical: theme.space.xl,
    gap: theme.space.sm,
  },
  bigValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  address: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 22,
  },
  explainer: {
    marginTop: theme.space.xs,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textMuted,
  },
  copyButton: {
    marginTop: theme.space.md,
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
    fontWeight: '600',
    color: theme.colors.text,
  },
  signOut: {
    marginTop: theme.space.xl,
    alignSelf: 'stretch',
    minHeight: 52,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutPressed: {
    backgroundColor: theme.colors.surface,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
})
