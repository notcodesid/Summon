import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * In-app camera for scanning real animals.
 * Custom overlay UI can be refined later — live preview + capture is step one.
 */
export default function CameraScreen() {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const scanWidth = Math.min(width - 32, 432)
  const scanHeight = Math.min(scanWidth * 1.16, height * 0.58)

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [])

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !ready || capturing) return

    setCapturing(true)
    try {
      await cameraRef.current.takePictureAsync({
        quality: 0.85,
        shutterSound: true,
      })
      // Next: feed capture into collect / identification.
      // For now, take the shot and return home.
      handleClose()
    } catch {
      setCapturing(false)
    }
  }, [capturing, handleClose, ready])

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FCFCFB" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <Text style={styles.permissionTitle}>camera access</Text>
        <Text style={styles.permissionBody}>summon needs the camera to scan real animals you find.</Text>
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
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        onCameraReady={() => setReady(true)}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.dim, { height: Math.max(insets.top + 116, 116) }]} />
        <View style={styles.scanRow}>
          <View style={styles.dim} />
          <View style={[styles.scanFrame, { width: scanWidth, height: scanHeight }]}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <View style={styles.dim} />
        </View>
        <View style={styles.dim} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable
          onPress={handleClose}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color="#FCFCFB" />
        </Pressable>
        <View style={styles.scanTitle}>
          <Text style={styles.scanTitleText}>summon</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]} pointerEvents="box-none">
        <Pressable
          onPress={handleCapture}
          disabled={!ready || capturing}
          style={[styles.shutterOuter, (!ready || capturing) && styles.shutterDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: {
    color: '#FCFCFB',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  permissionBody: {
    color: 'rgba(252,252,251,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: '#FCFCFB',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  permissionButtonText: {
    color: '#111210',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionCancel: {
    marginTop: 8,
    color: 'rgba(252,252,251,0.55)',
    fontSize: 14,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  scanTitleText: {
    color: '#FCFCFB',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  dim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  scanRow: {
    flexDirection: 'row',
  },
  scanFrame: {
    position: 'relative',
    borderRadius: 5,
  },
  corner: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderColor: 'rgba(252,252,251,0.9)',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 5,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 5,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 5,
  },
  cornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderBottomRightRadius: 5,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FCFCFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FCFCFB',
  },
  shutterDisabled: {
    opacity: 0.45,
  },
})
