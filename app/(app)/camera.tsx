import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions, type FlashMode } from 'expo-camera'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { setPendingCapture } from '@/lib/pending-capture'
import { theme } from '@/constants/theme'

type Shot = {
  uri: string
  base64: string
}

type Phase =
  | { status: 'live' }
  | { status: 'capturing' }
  | { status: 'review'; shot: Shot }

/**
 * Scan step 1 — capture experience only.
 * Identify comes later. Here: guide, shutter feel, freeze, retake / use.
 */
export default function CameraScreen() {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [ready, setReady] = useState(false)
  const [flash, setFlash] = useState<FlashMode>('off')
  const [phase, setPhase] = useState<Phase>({ status: 'live' })

  const flashOpacity = useRef(new Animated.Value(0)).current
  const shutterScale = useRef(new Animated.Value(1)).current
  const framePulse = useRef(new Animated.Value(0.55)).current

  const scanWidth = Math.min(width - 32, 432)
  const scanHeight = Math.min(scanWidth * 1.16, height * 0.58)
  const isReview = phase.status === 'review'
  const isBusy = phase.status === 'capturing'
  const canShoot = ready && phase.status === 'live'

  useEffect(() => {
    if (phase.status !== 'live') return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(framePulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(framePulse, {
          toValue: 0.55,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [framePulse, phase.status])

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  const cycleFlash = useCallback(() => {
    void Haptics.selectionAsync()
    setFlash((prev) => {
      if (prev === 'off') return 'on'
      if (prev === 'on') return 'auto'
      return 'off'
    })
  }, [])

  const runShutterAnim = useCallback(() => {
    Animated.sequence([
      Animated.timing(shutterScale, {
        toValue: 0.88,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.timing(shutterScale, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()

    flashOpacity.setValue(0.85)
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [flashOpacity, shutterScale])

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !canShoot) return

    setPhase({ status: 'capturing' })
    runShutterAnim()
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.65,
        base64: true,
        shutterSound: true,
        skipProcessing: false,
      })

      if (!photo?.uri || !photo.base64) {
        setPhase({ status: 'live' })
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setPhase({
        status: 'review',
        shot: { uri: photo.uri, base64: photo.base64 },
      })
    } catch {
      setPhase({ status: 'live' })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }, [canShoot, runShutterAnim])

  const handleRetake = useCallback(() => {
    void Haptics.selectionAsync()
    setPhase({ status: 'live' })
  }, [])

  const handleUsePhoto = useCallback(() => {
    if (phase.status !== 'review') return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPendingCapture(phase.shot)
    router.replace('/reveal')
  }, [phase])

  const flashIcon =
    flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off'

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.onDark} />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={28} color={theme.colors.onDark} />
        </View>
        <Text style={styles.permissionTitle}>camera access</Text>
        <Text style={styles.permissionBody}>
          summon needs the camera to scan real animals you find outside.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Allow camera access"
        >
          <Text style={styles.permissionButtonText}>allow camera</Text>
        </Pressable>
        <Pressable onPress={handleClose} hitSlop={12}>
          <Text style={styles.permissionCancel}>not now</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Keep camera mounted under freeze so retake is instant. */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        flash={flash}
        onCameraReady={() => setReady(true)}
      />

      {isReview ? (
        <Image
          source={{ uri: phase.shot.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[styles.flashOverlay, { opacity: flashOpacity }]}
      />

      {/* Dim + scan frame */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.dim, { height: Math.max(insets.top + 108, 108) }]} />
        <View style={styles.scanRow}>
          <View style={styles.dim} />
          <Animated.View
            style={[
              styles.scanFrame,
              {
                width: scanWidth,
                height: scanHeight,
                opacity: isReview ? 1 : framePulse,
              },
            ]}
          >
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            {!isReview ? (
              <View style={styles.frameHint}>
                <Text style={styles.frameHintText}>
                  {isBusy ? 'hold still…' : 'frame the animal'}
                </Text>
              </View>
            ) : null}
          </Animated.View>
          <View style={styles.dim} />
        </View>
        <View style={styles.dim} />
      </View>

      {/* Top chrome */}
      <View
        style={[styles.topBar, { paddingTop: insets.top + 10 }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={handleClose}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          hitSlop={12}
        >
          <Ionicons name="close" size={24} color={theme.colors.onDark} />
        </Pressable>

        <View style={styles.scanTitle}>
          <Text style={styles.scanTitleText}>
            {isReview ? 'got it?' : 'scan'}
          </Text>
          <Text style={styles.scanSubtitle}>
            {isReview ? 'use this shot or retake' : 'point at a real animal'}
          </Text>
        </View>

        {isReview ? (
          <View style={styles.headerSpacer} />
        ) : (
          <Pressable
            onPress={cycleFlash}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={`Flash ${flash}`}
            hitSlop={12}
          >
            <Ionicons name={flashIcon} size={22} color={theme.colors.onDark} />
          </Pressable>
        )}
      </View>

      {/* Bottom controls */}
      <View
        style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 28) }]}
        pointerEvents="box-none"
      >
        {isReview ? (
          <View style={styles.reviewRow}>
            <Pressable
              onPress={handleRetake}
              style={({ pressed }) => [
                styles.reviewButton,
                styles.reviewSecondary,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
            >
              <Ionicons name="refresh" size={20} color={theme.colors.onDark} />
              <Text style={styles.reviewSecondaryText}>retake</Text>
            </Pressable>

            <Pressable
              onPress={handleUsePhoto}
              style={({ pressed }) => [
                styles.reviewButton,
                styles.reviewPrimary,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Use this photo"
            >
              <Ionicons name="checkmark" size={22} color={theme.colors.viewfinder} />
              <Text style={styles.reviewPrimaryText}>use photo</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.liveHint}>
              {ready ? 'tap to capture' : 'starting camera…'}
            </Text>
            <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
              <Pressable
                onPress={handleCapture}
                disabled={!canShoot}
                style={[
                  styles.shutterOuter,
                  !canShoot && styles.shutterDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Capture photo"
              >
                {isBusy ? (
                  <ActivityIndicator color={theme.colors.viewfinder} />
                ) : (
                  <View style={styles.shutterInner} />
                )}
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.viewfinder,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.colors.viewfinder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(252,252,251,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  permissionTitle: {
    color: theme.colors.onDark,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  permissionBody: {
    color: 'rgba(252,252,251,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: theme.colors.onDark,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  permissionButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  permissionCancel: {
    marginTop: 8,
    color: 'rgba(252,252,251,0.55)',
    fontSize: 14,
    fontWeight: '600',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 5,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scanTitle: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  scanTitleText: {
    color: theme.colors.onDark,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  scanSubtitle: {
    marginTop: 2,
    color: 'rgba(252,252,251,0.62)',
    fontSize: 12,
    fontWeight: '600',
  },
  dim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  scanRow: {
    flexDirection: 'row',
  },
  scanFrame: {
    position: 'relative',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  frameHint: {
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  frameHintText: {
    color: 'rgba(252,252,251,0.92)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: 'rgba(252,252,251,0.95)',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 8,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 14,
    zIndex: 10,
  },
  liveHint: {
    color: 'rgba(252,252,251,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: theme.colors.onDark,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.onDark,
  },
  shutterDisabled: {
    opacity: 0.45,
  },
  reviewRow: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  reviewSecondary: {
    borderWidth: 1.5,
    borderColor: 'rgba(252,252,251,0.45)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  reviewPrimary: {
    backgroundColor: theme.colors.onDark,
  },
  reviewSecondaryText: {
    color: theme.colors.onDark,
    fontSize: 16,
    fontWeight: '800',
  },
  reviewPrimaryText: {
    color: theme.colors.viewfinder,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
})
