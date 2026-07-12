import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import { router } from 'expo-router'
import { usePrivy } from '@privy-io/expo'
import { theme } from '@/constants/theme'

/**
 * Premium animated splash and handoff screen.
 * Shows the black branding star with a spring entrance, a breathing idle state
 * if auth is pending, and a smooth dissolve transition once Privy is ready.
 */
export default function Index() {
  const { isReady, user } = usePrivy()
  const [animationFinished, setAnimationFinished] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Animated values
  const scale = useRef(new Animated.Value(0.3)).current
  const opacity = useRef(new Animated.Value(0)).current
  const rotate = useRef(new Animated.Value(0)).current
  const idlePulse = useRef(new Animated.Value(1)).current

  const idleLoopRef = useRef<Animated.CompositeAnimation | null>(null)

  // 1. Entry Animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnimationFinished(true)
    })
  }, [scale, opacity, rotate])

  // 2. Idle Animation (Breathing pulse if Privy initialization is slow)
  useEffect(() => {
    if (animationFinished && !isReady) {
      idleLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(idlePulse, {
            toValue: 1.08,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(idlePulse, {
            toValue: 1.0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
      idleLoopRef.current.start()
    } else if (isReady && idleLoopRef.current) {
      idleLoopRef.current.stop()
    }

    return () => {
      if (idleLoopRef.current) {
        idleLoopRef.current.stop()
      }
    }
  }, [animationFinished, isReady, idlePulse])

  // 3. Outro Animation & Navigation Transition
  useEffect(() => {
    if (isReady && animationFinished && !isTransitioning) {
      setIsTransitioning(true)

      if (idleLoopRef.current) {
        idleLoopRef.current.stop()
      }

      // Smooth dissolve & scale outwards
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!user) {
          router.replace('/onboarding')
        } else {
          router.replace('/(tabs)')
        }
      })
    }
  }, [isReady, animationFinished, isTransitioning, user, scale, opacity])

  // Interpolated rotation mapping
  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-45deg', '0deg'],
  })

  // Combine intro spring/outro scale and idle breathing pulse
  const animatedScale = Animated.multiply(scale, idlePulse)

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}
    >
      <Animated.Image
        source={require('@/assets/images/logo-mark.png')}
        style={{
          width: 140,
          height: 140,
          resizeMode: 'contain',
          tintColor: '#000000',
          opacity: opacity,
          transform: [{ scale: animatedScale }, { rotate: spin }],
        }}
      />
    </View>
  )
}
