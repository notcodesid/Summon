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

  const totalExp = creatures.length * 50
  const level = Math.floor(totalExp / 100) + 1
  const currentLevelExp = totalExp % 100
  const expProgress = currentLevelExp / 100

  const medals = [
    {
      id: 'first_scan',
      title: 'First Scan',
      desc: 'Scan 1 animal',
      image: require('@/assets/goal-icons/sunflower.png'),
      unlocked: creatures.length >= 1,
      progress: Math.min(creatures.length, 1) / 1,
    },
    {
      id: 'wildlife_scout',
      title: 'Wildlife Scout',
      desc: 'Save 5 animals',
      image: require('@/assets/goal-icons/water.png'),
      unlocked: creatures.length >= 5,
      progress: Math.min(creatures.length, 5) / 5,
    },
    {
      id: 'rare_hunter',
      title: 'Rare Finder',
      desc: 'Catch a rare species',
      image: require('@/assets/goal-icons/lead_badge.png'),
      unlocked: creatures.some((c) => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary'),
      progress: creatures.some((c) => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary') ? 1 : 0,
    },
  ]

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
        {/* Top Right Gear Settings Button */}
        <View style={styles.topRightHeader}>
          <Pressable
            style={({ pressed }) => [styles.gearBtn, pressed && styles.pressedOpacity]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setSettingsOpen(true)
            }}
          >
            <Ionicons name="settings-sharp" size={18} color="#38BDF8" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Pure Floating Profile Header (No white box!) */}
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

            {/* Floating Glass EXP & Level Bar */}
            <View style={styles.floatingLevelCard}>
              <View style={styles.levelHeaderRow}>
                <Text style={styles.levelTitle}>LEVEL {level} EXPLORER</Text>
                <Text style={styles.expText}>{currentLevelExp} / 100 EXP</Text>
              </View>
              <View style={styles.expTrack}>
                <View style={[styles.expFill, { width: `${Math.min(Math.max(expProgress * 100, 6), 100)}%` }]} />
              </View>
            </View>

            {/* Floating Species Saved Pill */}
            <View style={styles.floatingStatsPill}>
              <Ionicons name="paw" size={14} color="#38BDF8" />
              <Text style={styles.speciesSavedText}>
                {creatures.length} {creatures.length === 1 ? 'SPECIES SAVED' : 'SPECIES SAVED'}
              </Text>
            </View>
          </View>

          {/* Active Companion / Buddy Card */}
          <View style={styles.companionCard}>
            <Text style={styles.companionSectionTitle}>ACTIVE COMPANION</Text>
            <View style={styles.companionRow}>
              <View style={styles.companionAvatarCircle}>
                {activeCompanion.photoUri ? (
                  <Image source={{ uri: activeCompanion.photoUri }} style={styles.companionPhoto} contentFit="cover" />
                ) : (
                  <Image
                    source={require('@/assets/tab-icons-transparent/profile.png')}
                    style={styles.companionMascotImg}
                    contentFit="contain"
                  />
                )}
              </View>

              <View style={styles.companionInfo}>
                <Text style={styles.companionName}>{activeCompanion.commonName}</Text>
                <Text style={styles.companionSpecies}>{activeCompanion.species}</Text>
                <View style={styles.companionRarityBadge}>
                  <Text style={styles.companionRarityText}>{activeCompanion.rarity.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.companionPowerPill}>
                <Ionicons name="flash" size={14} color="#F59E0B" />
                <Text style={styles.companionPowerVal}>{activeCompanion.stats?.attack || 50}</Text>
              </View>
            </View>
          </View>

          {/* Achievement Medals Card */}
          <View style={styles.medalsCard}>
            <Text style={styles.medalsSectionTitle}>EXPLORER MEDALS</Text>
            <View style={styles.medalsRow}>
              {medals.map((m) => (
                <View key={m.id} style={styles.medalItem}>
                  <View style={styles.medalIconCircle}>
                    <Image source={m.image} style={styles.medalBadgeImg} contentFit="contain" />
                    {!m.unlocked ? (
                      <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={10} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.medalTitle}>{m.title}</Text>
                  <Text style={styles.medalDesc}>{m.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
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
                <Ionicons name="close" size={20} color="#F8FAFC" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {/* Account Section */}
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} onPress={onSignOut}>
                  <View style={[styles.modalIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name="log-out-outline" size={17} color="#EF4444" />
                  </View>
                  <Text style={[styles.modalRowText, { color: '#EF4444' }]}>Sign Out</Text>
                  <Ionicons name="chevron-forward" size={16} color="#64748B" />
                </Pressable>
              </View>

              {/* Legal Section */}
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} onPress={() => openExternal(AppConfig.privacyUrl)}>
                  <View style={styles.modalIconBg}>
                    <Ionicons name="shield-checkmark-outline" size={17} color="#38BDF8" />
                  </View>
                  <Text style={styles.modalRowText}>Privacy Policy</Text>
                  <Ionicons name="open-outline" size={15} color="#64748B" />
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable style={styles.modalRow} onPress={() => openExternal(AppConfig.termsUrl)}>
                  <View style={styles.modalIconBg}>
                    <Ionicons name="document-text-outline" size={17} color="#38BDF8" />
                  </View>
                  <Text style={styles.modalRowText}>Terms of Service</Text>
                  <Ionicons name="open-outline" size={15} color="#64748B" />
                </Pressable>

                {AppConfig.supportEmail ? (
                  <>
                    <View style={styles.modalDivider} />
                    <Pressable style={styles.modalRow} onPress={() => openExternal(`mailto:${AppConfig.supportEmail}`)}>
                      <View style={styles.modalIconBg}>
                        <Ionicons name="mail-outline" size={17} color="#38BDF8" />
                      </View>
                      <Text style={styles.modalRowText}>Contact Support</Text>
                      <Ionicons name="chevron-forward" size={16} color="#64748B" />
                    </Pressable>
                  </>
                ) : null}
              </View>

              {/* Data Management Section */}
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} disabled={deleting} onPress={onClearCollection}>
                  <View style={[styles.modalIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name="trash-outline" size={17} color="#EF4444" />
                  </View>
                  <Text style={[styles.modalRowText, { color: '#EF4444' }]}>Delete Saved Collection</Text>
                  <Ionicons name="chevron-forward" size={16} color="#64748B" />
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable style={styles.modalRow} disabled={deleting} onPress={onDeleteAccount}>
                  <View style={[styles.modalIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name="warning-outline" size={17} color="#EF4444" />
                  </View>
                  <Text style={[styles.modalRowText, { color: '#EF4444' }]}>
                    {deleting ? 'Deleting...' : 'Delete Account Data'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#64748B" />
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
    backgroundColor: '#0F172A',
  },
  safe: {
    flex: 1,
  },
  topRightHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  gearBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  floatingProfileHeader: {
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  floatingPlayerName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  floatingLevelCard: {
    width: '94%',
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    gap: 6,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.6,
  },
  expText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  expTrack: {
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  expFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 4,
  },
  floatingStatsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  speciesSavedText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.6,
  },
  companionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    gap: 10,
  },
  companionSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 1,
  },
  companionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  companionAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  companionPhoto: {
    width: 52,
    height: 52,
  },
  companionMascotImg: {
    width: 44,
    height: 44,
  },
  companionInfo: {
    flex: 1,
    gap: 2,
  },
  companionName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  companionSpecies: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  companionRarityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 2,
  },
  companionRarityText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  companionPowerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  companionPowerVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F59E0B',
  },
  medalsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  medalsSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 1,
  },
  medalsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
  },
  medalItem: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  medalIconCircle: {
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  medalBadgeImg: {
    width: 44,
    height: 44,
  },
  lockBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  medalTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  medalDesc: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
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
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#0F172A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '75%',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(56, 189, 248, 0.35)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSection: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pressedOpacity: {
    opacity: 0.75,
  },
})
