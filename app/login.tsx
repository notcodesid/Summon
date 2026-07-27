import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Redirect, router } from 'expo-router'
import { useLoginWithOAuth, usePrivy } from '@privy-io/expo'
import { AppConfig } from '@/constants/app-config'
import { theme } from '@/constants/theme'
import { googleOAuthProvider, isAuthBypassed, isPrivyConfigured } from '@/lib/privy-config'

/**
 * Sign in with Google via Privy. The Privy user id keys everything the player
 * collects, and the embedded Solana wallet is created just after.
 */
export default function LoginScreen() {
  if (isAuthBypassed) {
    return <Redirect href="/" />
  }
  if (!isPrivyConfigured) {
    return <PrivyConfigMissing />
  }
  return <LoginWithPrivy />
}

function PrivyConfigMissing() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.fallback}>
        <Text style={styles.headline}>{AppConfig.name}</Text>
        <Text style={styles.error}>
          Privy is not configured. Set EXPO_PUBLIC_PRIVY_APP_ID and EXPO_PUBLIC_PRIVY_CLIENT_ID in .env, then restart
          Expo with --clear.
        </Text>
      </View>
    </SafeAreaView>
  )
}

function LoginWithPrivy() {
  const { user, isReady } = usePrivy()
  const { login, state } = useLoginWithOAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const loading = state.status === 'loading'

  useEffect(() => {
    if (isReady && user) {
      router.replace('/')
    }
  }, [isReady, user])

  const onGoogle = useCallback(async () => {
    setErrorMessage(null)
    try {
      await login({ provider: googleOAuthProvider })
      router.replace('/')
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Google sign-in failed')
    }
  }, [login])

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (user) {
    return <Redirect href="/" />
  }

  const oauthError = state.status === 'error' && state.error?.message ? state.error.message : null

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.delay(120).duration(520)} style={styles.headlineBlock}>
          <Text style={styles.headline}>Pokémon, but real.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(520)} style={styles.actions}>
          <Pressable
            onPress={() => void onGoogle()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              loading && styles.googleButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#111210" />
            ) : (
              <>
                {/* Left-anchored mark with a centred label — Google's own
                    button layout. */}
                <Image source={require('../assets/brand/google-g.png')} style={styles.googleMark} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {/* Errors still surface here — only the standing caption is gone. */}
          {errorMessage || oauthError ? (
            <Animated.Text entering={FadeIn} style={styles.error}>
              {errorMessage ?? oauthError}
            </Animated.Text>
          ) : null}
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.space.xl,
    paddingBottom: theme.space.xxl,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space.xl,
    gap: theme.space.lg,
  },
  headlineBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  headline: {
    // Matched to the reference: ~32pt at 1.28 leading, Bold rather than
    // Heavy. 800 read as chunky at this size, and -1 tracking was cramped.
    fontSize: 32,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: theme.colors.text,
  },
  actions: {
    marginTop: 'auto',
    gap: theme.space.lg,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: theme.space.xxl,
    // The page ground is warm off-white, so white alone would not separate.
    // A soft shadow lifts it; the hairline keeps the edge legible.
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  googleMark: {
    position: 'absolute',
    left: theme.space.xl,
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  googleButtonPressed: {
    backgroundColor: theme.colors.surface,
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonText: {
    color: '#111210',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
})
