import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Redirect, router } from 'expo-router'
import { useLoginWithOAuth, usePrivy } from '@privy-io/expo'
import { AppConfig } from '@/constants/app-config'
import { theme } from '@/constants/theme'
import { hasSeenOnboarding } from '@/lib/onboarding'
import { googleOAuthProvider, isAuthBypassed, isPrivyConfigured } from '@/lib/privy-config'

/**
 * Sign in with Google via Privy. The Privy user id keys everything the player
 * collects, and the embedded Solana wallet is created just after.
 */
export default function LoginScreen() {
  // undefined = still reading storage; avoids a flash of the sign-in screen
  // before we know whether this device has seen the intro.
  const [seenIntro, setSeenIntro] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    let active = true
    void hasSeenOnboarding().then((seen) => {
      if (active) setSeenIntro(seen)
    })
    return () => {
      active = false
    }
  }, [])

  if (isAuthBypassed) {
    return <Redirect href="/" />
  }
  if (!isPrivyConfigured) {
    return <PrivyConfigMissing />
  }
  if (seenIntro === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    )
  }
  if (!seenIntro) {
    return <Redirect href="/onboarding" />
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
  const openLegal = useCallback((url: string) => {
    void Linking.openURL(url)
  }, [])

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
    <View style={styles.rootContainer}>
      {/* Brand backdrop: deep field ground behind the hero. */}
      <View style={styles.skyLayer} />
      <View style={styles.groundLayer} />

      <Image source={require('../assets/explorer-hero.png')} style={styles.hero} contentFit="contain" />

      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Animated.View entering={FadeInDown.delay(280).duration(520)} style={styles.actionsCard}>
            {/* Google Sign-In Button */}
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
                  <Image
                    source={require('../assets/brand/google-g.png')}
                    style={styles.googleMark}
                    contentFit="contain"
                  />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {errorMessage || oauthError ? (
              <Animated.Text entering={FadeIn} style={styles.error}>
                {errorMessage ?? oauthError}
              </Animated.Text>
            ) : null}

            <Text style={styles.consent}>
              By continuing, you agree to the{' '}
              <Text style={styles.consentLink} onPress={() => openLegal(AppConfig.termsUrl)}>
                terms
              </Text>{' '}
              and{' '}
              <Text style={styles.consentLink} onPress={() => openLegal(AppConfig.privacyUrl)}>
                privacy policy
              </Text>
              .
            </Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: theme.colors.viewfinder,
  },
  skyLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.viewfinder,
  },
  groundLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    backgroundColor: '#141C16',
  },
  hero: {
    position: 'absolute',
    alignSelf: 'center',
    top: '16%',
    width: '78%',
    height: '54%',
  },
  safe: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.space.xl,
    paddingBottom: theme.space.xl,
    justifyContent: 'flex-end',
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space.xl,
    gap: theme.space.lg,
  },
  headline: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: theme.colors.text,
  },
  actionsCard: {
    gap: theme.space.md,
    marginBottom: 12,
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
    borderWidth: 1.5,
    borderColor: '#EAEFEA',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  googleMark: {
    position: 'absolute',
    left: theme.space.xl,
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  googleButtonPressed: {
    backgroundColor: '#F5F9F6',
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonText: {
    color: '#18221C',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    color: '#E53935',
    textAlign: 'center',
  },
  consent: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  consentLink: {
    color: '#FFFFFF',
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
})
