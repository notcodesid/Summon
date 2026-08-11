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

  const speciesCount = creatures.length
  const discoveriesCount = creatures.length
  const rareCount = creatures.filter(
    (c) => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary',
  ).length

  const totalExp = creatures.length * 50
  const level = Math.floor(totalExp / 100) + 1
  const currentLevelExp = totalExp % 100
  const expProgress = currentLevelExp / 100

  const medals = [
    {
      id: 'first_scan',
      title: 'First Scan',
      emoji: '🌻',
      unlocked: creatures.length >= 1,
    },
    {
      id: 'wildlife_scout',
      title: 'Wildlife Scout',
      emoji: '🧃',
      unlocked: creatures.length >= 5,
    },
    {
      id: 'rare_hunter',
      title: 'Rare Finder',
      emoji: '🛡️',
      unlocked: rareCount > 0,
    },
  ]

  const recentDiscoveries = creatures.slice(0, 4)
  // Fill up field guide preview slots (up to 4 items)
  const fieldGuidePreview = Array.from({ length: 4 }).map((_, i) => creatures[i] || null)

  const handleName = player.name
    ? `@${player.name.toLowerCase().replace(/\s+/g, '')}`
    : '@explorer'

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
      {/* Background Artwork */}
      <Image
        source={require('@/assets/sanctuary.jpg')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      {/* Darkened readability overlay */}
      <View style={styles.darkOverlay} />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity Header & Settings Button */}
          <View style={styles.topBarRow}>
            <View style={styles.avatarContainer}>
              <Avatar
                initials={initialsFor(player)}
                uri={avatarUrl}
                size={64}
                onPress={onChoosePhoto}
                accessibilityLabel="Change profile picture"
              />
              <View style={styles.cameraBadge} pointerEvents="none">
                {savingPhoto ? (
                  <ActivityIndicator size="small" color="#171A17" />
                ) : (
                  <Ionicons name="camera" size={11} color="#171A17" />
                )}
              </View>
            </View>

            <View style={styles.namesColumn}>
              <Text style={styles.displayName}>{player.name || 'Explorer'}</Text>
              <Text style={styles.handleText}>{handleName}</Text>
              <Text style={styles.levelBadge}>✦ Level {level} Explorer</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.gearBtn, pressed && styles.pressedOpacity]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setSettingsOpen(true)
              }}
            >
              <Ionicons name="settings-sharp" size={18} color="#B7F34A" />
            </Pressable>
          </View>

          {/* Compact Level XP Bar */}
          <View style={styles.compactXpCard}>
            <View style={styles.xpHeaderRow}>
              <Text style={styles.xpTitle}>PROGRESSION</Text>
              <Text style={styles.xpVal}>{currentLevelExp} / 100 XP</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.min(Math.max(expProgress * 100, 5), 100)}%` }]} />
            </View>
          </View>

          {/* Primary Discovery Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statNumber}>{speciesCount}</Text>
              <Text style={styles.statLabel}>SPECIES</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNumber}>{discoveriesCount}</Text>
              <Text style={styles.statLabel}>DISCOVERIES</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNumber}>{rareCount}</Text>
              <Text style={styles.statLabel}>RARE</Text>
            </View>
          </View>

          {/* Field Guide Section Entry */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>FIELD GUIDE</Text>
                <Text style={styles.sectionSubtitle}>{speciesCount} / 386 species discovered</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B7F34A" />
            </View>
            <View style={styles.fieldGuideRow}>
              {fieldGuidePreview.map((item, idx) => (
                <View key={item?.id || `empty-${idx}`} style={styles.fieldGuideItem}>
                  {item?.photoUri ? (
                    <Image source={{ uri: item.photoUri }} style={styles.fieldGuidePhoto} contentFit="cover" />
                  ) : (
                    <View style={styles.silhouetteBox}>
                      <Text style={styles.silhouetteQuestionMark}>?</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Recent Discoveries Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>RECENT DISCOVERIES</Text>
            {recentDiscoveries.length > 0 ? (
              <View style={styles.recentList}>
                {recentDiscoveries.map((c) => (
                  <View key={c.id} style={styles.recentRow}>
                    <View style={styles.recentPhotoWrap}>
                      {c.photoUri ? (
                        <Image source={{ uri: c.photoUri }} style={styles.recentPhoto} contentFit="cover" />
                      ) : (
                        <Ionicons name="paw" size={18} color="#B7F34A" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentName}>{c.commonName}</Text>
                      <Text style={styles.recentSpecies}>{c.species}</Text>
                    </View>
                    <Text style={styles.recentTime}>
                      {c.capturedAt ? new Date(c.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyDiscoveriesBox}>
                <Text style={styles.emptyTitle}>Your field guide is empty.</Text>
                <Text style={styles.emptySubtitle}>Go see what's around you.</Text>
              </View>
            )}
          </View>

          {/* Compact Explorer Medals */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>EXPLORER MEDALS</Text>
            <View style={styles.compactMedalsRow}>
              {medals.map((m) => (
                <View key={m.id} style={styles.compactMedalCell}>
                  <Text style={styles.compactMedalEmoji}>{m.emoji}</Text>
                  <Text style={styles.compactMedalTitle}>{m.title}</Text>
                  <Text style={[styles.compactMedalBadge, m.unlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
                    {m.unlocked ? '✓' : '🔒'}
                  </Text>
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
                <Ionicons name="close" size={20} color="#F5F2E9" />
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
                  <Ionicons name="chevron-forward" size={16} color="#68736A" />
                </Pressable>
              </View>

              {/* Legal Section */}
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} onPress={() => openExternal(AppConfig.privacyUrl)}>
                  <View style={styles.modalIconBg}>
                    <Ionicons name="shield-checkmark-outline" size={17} color="#B7F34A" />
                  </View>
                  <Text style={styles.modalRowText}>Privacy Policy</Text>
                  <Ionicons name="open-outline" size={15} color="#68736A" />
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable style={styles.modalRow} onPress={() => openExternal(AppConfig.termsUrl)}>
                  <View style={styles.modalIconBg}>
                    <Ionicons name="document-text-outline" size={17} color="#B7F34A" />
                  </View>
                  <Text style={styles.modalRowText}>Terms of Service</Text>
                  <Ionicons name="open-outline" size={15} color="#68736A" />
                </Pressable>

                {AppConfig.supportEmail ? (
                  <>
                    <View style={styles.modalDivider} />
                    <Pressable style={styles.modalRow} onPress={() => openExternal(`mailto:${AppConfig.supportEmail}`)}>
                      <View style={styles.modalIconBg}>
                        <Ionicons name="mail-outline" size={17} color="#B7F34A" />
                      </View>
                      <Text style={styles.modalRowText}>Contact Support</Text>
                      <Ionicons name="chevron-forward" size={16} color="#68736A" />
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
                  <Ionicons name="chevron-forward" size={16} color="#68736A" />
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable style={styles.modalRow} disabled={deleting} onPress={onDeleteAccount}>
                  <View style={[styles.modalIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name="warning-outline" size={17} color="#EF4444" />
                  </View>
                  <Text style={[styles.modalRowText, { color: '#EF4444' }]}>
                    {deleting ? 'Deleting...' : 'Delete Account Data'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#68736A" />
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
    backgroundColor: '#0F1411',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 20, 17, 0.78)',
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24, 32, 25, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(183, 243, 74, 0.3)',
  },
  avatarContainer: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#B7F34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F1411',
  },
  namesColumn: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F5F2E9',
    letterSpacing: -0.3,
  },
  handleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA69D',
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B7F34A',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  compactXpCard: {
    backgroundColor: 'rgba(24, 32, 25, 0.88)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(183, 243, 74, 0.25)',
    gap: 6,
  },
  xpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  xpTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F5F2E9',
    letterSpacing: 0.8,
  },
  xpVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B7F34A',
  },
  xpTrack: {
    height: 6,
    backgroundColor: '#0F1411',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#B7F34A',
    borderRadius: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182019',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(183, 243, 74, 0.3)',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F5F2E9',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B7F34A',
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(245, 242, 233, 0.12)',
  },
  sectionCard: {
    backgroundColor: '#182019',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(183, 243, 74, 0.25)',
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#B7F34A',
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA69D',
    marginTop: 2,
  },
  fieldGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  fieldGuideItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#0F1411',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 242, 233, 0.08)',
  },
  fieldGuidePhoto: {
    width: '100%',
    height: '100%',
  },
  silhouetteBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  silhouetteQuestionMark: {
    fontSize: 18,
    fontWeight: '900',
    color: '#68736A',
  },
  recentList: {
    gap: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F1411',
    padding: 10,
    borderRadius: 14,
  },
  recentPhotoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#182019',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(183, 243, 74, 0.3)',
  },
  recentPhoto: {
    width: 40,
    height: 40,
  },
  recentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F5F2E9',
  },
  recentSpecies: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA69D',
  },
  recentTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#68736A',
  },
  emptyDiscoveriesBox: {
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F5F2E9',
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA69D',
  },
  compactMedalsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  compactMedalCell: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1411',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 242, 233, 0.08)',
    gap: 4,
  },
  compactMedalEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  compactMedalTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F5F2E9',
    textAlign: 'center',
    lineHeight: 14,
  },
  compactMedalBadge: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  badgeUnlocked: {
    color: '#B7F34A',
  },
  badgeLocked: {
    color: '#68736A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#182019',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '75%',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(183, 243, 74, 0.35)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 242, 233, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F5F2E9',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F1411',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSection: {
    backgroundColor: '#0F1411',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 242, 233, 0.08)',
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
    backgroundColor: 'rgba(183, 243, 74, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#F5F2E9',
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(245, 242, 233, 0.08)',
  },
  pressedOpacity: {
    opacity: 0.75,
  },
})
