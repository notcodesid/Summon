import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { usePrivy } from '@privy-io/expo'
import { Avatar } from '@/components/ui'
import { AppConfig } from '@/constants/app-config'
import { deleteAccountData } from '@/lib/account'
import { clearCollection, loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { prepareImageForUpload } from '@/lib/image-processing'
import { savePlayerPhoto, usePlayerPhoto } from '@/lib/player-photo'
import { initialsFor, usePlayer } from '@/lib/use-player'

export default function ProfileScreen() {
  const { logout } = usePrivy()
  const player = usePlayer()
  const insets = useSafeAreaInsets()
  const { photoUrl, refresh } = usePlayerPhoto(player.privyUserId)
  const avatarUrl = photoUrl ?? player.googlePhotoUrl
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      void loadCollection(player.privyUserId).then((next) => {
        if (active) setCreatures(next)
      })
      return () => {
        active = false
      }
    }, [player.privyUserId]),
  )

  const totalPower = creatures.reduce((acc, c) => acc + (c.stats?.attack || 50), 0)
  const activeCompanion: Creature = creatures[0] || {
    id: 'mascot-lee',
    species: 'Sanctuary Mascot',
    commonName: 'Lee • Field Guide',
    rarity: 'common',
    stats: { hp: 100, attack: 50, defense: 50, speed: 50 },
    note: 'Tap to pet!',
    photoUri: '',
    capturedAt: Date.now(),
  }

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
    if (!asset?.uri || !asset.base64) {
      Alert.alert('Could not use that photo', 'Please choose another image.')
      return
    }

    setSavingPhoto(true)
    try {
      const prepared = await prepareImageForUpload(asset.uri, asset.width, asset.base64)
      const saved = await savePlayerPhoto(player.privyUserId, {
        source: 'upload',
        imageBase64: prepared.base64,
        localPhotoUri: prepared.uri,
      })
      if (saved) {
        await refresh()
      } else {
        Alert.alert('Upload failed', 'Please try again in a moment.')
      }
    } catch {
      Alert.alert('Could not prepare that photo', 'Choose a smaller image or update the app build and try again.')
    } finally {
      setSavingPhoto(false)
    }
  }, [player.privyUserId, refresh, savingPhoto])

  const onSignOut = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSettingsOpen(false)
    void logout().then(() => router.replace('/login'))
  }, [logout])

  const openExternal = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', 'Please try again in a browser.')
    })
  }, [])

  const onClearCollection = useCallback(() => {
    if (deleting || !player.privyUserId) return
    Alert.alert('Delete collection?', 'This permanently deletes every saved animal and its photo from Summon.', [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'delete collection',
        style: 'destructive',
        onPress: () => {
          setDeleting(true)
          void clearCollection(player.privyUserId).then((deleted) => {
            setDeleting(false)
            if (deleted) {
              setCreatures([])
              setSettingsOpen(false)
            } else {
              Alert.alert('Could not delete collection', 'Check your connection and try again.')
            }
          })
        },
      },
    ])
  }, [deleting, player.privyUserId])

  const onDeleteAccount = useCallback(() => {
    if (deleting || !player.privyUserId) return
    Alert.alert(
      'Delete account and data?',
      'This permanently deletes your Summon collection, photos, and profile data. This cannot be undone.',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'delete account',
          style: 'destructive',
          onPress: () => {
            setDeleting(true)
            void deleteAccountData(player.privyUserId).then((deleted) => {
              setDeleting(false)
              if (deleted) {
                setSettingsOpen(false)
                void logout().then(() => router.replace('/login'))
              } else {
                Alert.alert('Could not delete account', 'Check your connection and try again.')
              }
            })
          },
        },
      ],
    )
  }, [deleting, logout, player.privyUserId])

  return (
    <View style={styles.container}>
      {/* Sanctuary Outdoor Background Artwork */}
      <Image
        source={require('@/assets/sanctuary.jpg')}
        style={StyleSheet.absoluteFillObject}
        contentFit="fill"
      />

      <SafeAreaView style={styles.safe}>
        {/* Absolute Top-Right Gear Settings Button */}
        <View style={styles.topRightHeader}>
          <Pressable
            style={({ pressed }) => [styles.gearBtn, pressed && styles.pressedOpacity]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setSettingsOpen(true)
            }}
          >
            <Ionicons name="settings-sharp" size={20} color="#1A332B" />
          </Pressable>
        </View>

        <View style={styles.centerContainer}>
          {/* Pure Floating Profile (No white box!) */}
          <View style={styles.floatingProfileHeader}>
            <View style={styles.avatarContainer}>
              <Avatar
                initials={initialsFor(player)}
                uri={avatarUrl}
                size={96}
                onPress={onChoosePhoto}
                accessibilityLabel="Change profile picture"
              />
              <View style={styles.cameraBadge} pointerEvents="none">
                {savingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                )}
              </View>
            </View>

            <Text style={styles.floatingPlayerName}>{player.name || 'Explorer'}</Text>

            {/* Clean Single Species Saved Badge */}
            <View style={styles.floatingStatsPill}>
              <Ionicons name="paw" size={14} color="#2F7D5B" />
              <Text style={styles.speciesSavedText}>
                {creatures.length} {creatures.length === 1 ? 'SPECIES SAVED' : 'SPECIES SAVED'}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Settings & Account Modal Sheet */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                onPress={() => setSettingsOpen(false)}
              >
                <Ionicons name="close" size={20} color="#1A332B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {/* Account Section */}
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} onPress={onSignOut}>
                  <View style={[styles.modalIconBg, { backgroundColor: '#FDEAEB' }]}>
                    <Ionicons name="log-out-outline" size={17} color="#E53935" />
                  </View>
                  <Text style={[styles.modalRowText, { color: '#E53935' }]}>Sign Out</Text>
                  <Ionicons name="chevron-forward" size={16} color="#B5C9C1" />
                </Pressable>
              </View>

              {/* Legal Section */}
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} onPress={() => openExternal(AppConfig.privacyUrl)}>
                  <View style={styles.modalIconBg}>
                    <Ionicons name="shield-checkmark-outline" size={17} color="#2F7D5B" />
                  </View>
                  <Text style={styles.modalRowText}>Privacy Policy</Text>
                  <Ionicons name="open-outline" size={15} color="#9BB4AA" />
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable style={styles.modalRow} onPress={() => openExternal(AppConfig.termsUrl)}>
                  <View style={styles.modalIconBg}>
                    <Ionicons name="document-text-outline" size={17} color="#2F7D5B" />
                  </View>
                  <Text style={styles.modalRowText}>Terms of Service</Text>
                  <Ionicons name="open-outline" size={15} color="#9BB4AA" />
                </Pressable>

                {AppConfig.supportEmail ? (
                  <>
                    <View style={styles.modalDivider} />
                    <Pressable style={styles.modalRow} onPress={() => openExternal(`mailto:${AppConfig.supportEmail}`)}>
                      <View style={styles.modalIconBg}>
                        <Ionicons name="mail-outline" size={17} color="#2F7D5B" />
                      </View>
                      <Text style={styles.modalRowText}>Contact Support</Text>
                      <Ionicons name="chevron-forward" size={16} color="#B5C9C1" />
                    </Pressable>
                  </>
                ) : null}
              </View>

              {/* Data Management Section */}
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} disabled={deleting} onPress={onClearCollection}>
                  <View style={[styles.modalIconBg, { backgroundColor: '#FFF2F2' }]}>
                    <Ionicons name="trash-outline" size={17} color="#D32F2F" />
                  </View>
                  <Text style={[styles.modalRowText, { color: '#D32F2F' }]}>Delete Saved Collection</Text>
                  <Ionicons name="chevron-forward" size={16} color="#B5C9C1" />
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable style={styles.modalRow} disabled={deleting} onPress={onDeleteAccount}>
                  <View style={[styles.modalIconBg, { backgroundColor: '#FFF2F2' }]}>
                    <Ionicons name="warning-outline" size={17} color="#D32F2F" />
                  </View>
                  <Text style={[styles.modalRowText, { color: '#D32F2F' }]}>
                    {deleting ? 'Deleting...' : 'Delete Account Data'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#B5C9C1" />
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#61B6A9',
  },
  safe: {
    flex: 1,
  },
  topRightHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  gearBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  mainLayout: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    justifyContent: 'space-between',
  },
  floatingProfileHeader: {
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  floatingPlayerName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1A332B',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  floatingStatsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 4,
  },
  speciesSavedText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2F7D5B',
    letterSpacing: 0.8,
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2F7D5B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFEA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A332B',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF6F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSection: {
    backgroundColor: '#F7FAF8',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EAEFEA',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  modalIconBg: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EEF6F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#1A332B',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#EAEFEA',
  },
  pressedOpacity: {
    opacity: 0.75,
  },
})
