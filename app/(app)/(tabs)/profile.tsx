import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { FieldGuide } from '@/components/field-guide'
import { deleteAccountData } from '@/lib/account'
import { isMuted, playSound, setMuted } from '@/lib/audio'
import { clearCollection, loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { nextSpeciesMilestone, uniqueSpeciesCount } from '@/lib/discovery-library'
import { expeditionXpTotal, loadExpeditionLog } from '@/lib/expedition-log'
import { prepareImageForUpload } from '@/lib/image-processing'
import { captureXpFor, explorerProgress } from '@/lib/progression'
import { savePlayerPhoto, usePlayerPhoto } from '@/lib/player-photo'
import { initialsFor, usePlayer } from '@/lib/use-player'

export default function ProfileScreen() {
  const { logout } = usePrivy()
  const player = usePlayer()
  const insets = useSafeAreaInsets()
  const { photoUrl, refresh } = usePlayerPhoto(player.privyUserId)
  const avatarUrl = photoUrl ?? player.googlePhotoUrl
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [expeditionXp, setExpeditionXp] = useState(0)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(!isMuted())

  useFocusEffect(
    useCallback(() => {
      let active = true
      void (async () => {
        const [next, log] = await Promise.all([
          loadCollection(player.privyUserId),
          loadExpeditionLog(player.privyUserId),
        ])
        if (!active) return
        setCreatures(next)
        setExpeditionXp(expeditionXpTotal(log))
      })()
      return () => {
        active = false
      }
    }, [player.privyUserId]),
  )

  const speciesCount = uniqueSpeciesCount(creatures)
  const discoveriesCount = creatures.length
  const speciesMilestone = nextSpeciesMilestone(creatures)
  const rareCount = creatures.filter(
    (c) => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary',
  ).length

  // Explorer level is earned from framing good photos and finishing daily
  // expeditions — the same numbers the home screen pays out.
  const progress = explorerProgress(captureXpFor(creatures) + expeditionXp)

  const medals = [
    {
      id: 'first_scan',
      title: 'First Scan',
      icon: require('@/assets/goal-icons/sunflower.png'),
      unlocked: creatures.length >= 1,
    },
    {
      id: 'wildlife_scout',
      title: 'Wildlife Scout',
      icon: require('@/assets/goal-icons/water.png'),
      unlocked: creatures.length >= 5,
    },
    {
      id: 'rare_hunter',
      title: 'Rare Finder',
      icon: require('@/assets/goal-icons/lead_badge.png'),
      unlocked: rareCount > 0,
    },
  ]

  const recentDiscoveries = creatures.slice(0, 4)
  const handleName = player.name ? `@${player.name.toLowerCase().replace(/\s+/g, '')}` : '@explorer'

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
      <Image source={require('@/assets/sanctuary.jpg')} style={StyleSheet.absoluteFillObject} contentFit="cover" />
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
              <Text style={styles.levelBadge}>✦ Level {progress.level} Explorer</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.gearBtn, pressed && styles.pressedOpacity]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setSettingsOpen(true)
              }}
            >
              <Ionicons name="settings-outline" size={20} color="#F5F2E9" />
            </Pressable>
          </View>

          {/* Compact Level XP Bar */}
          <View style={styles.compactXpCard}>
            <View style={styles.xpHeaderRow}>
              <Text style={styles.xpTitle}>PROGRESSION</Text>
              <Text style={styles.xpVal}>
                {progress.xpIntoLevel} / {progress.xpForLevel} XP
              </Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.min(Math.max(progress.progress * 100, 5), 100)}%` }]} />
            </View>
            <Text style={styles.xpFootnote}>
              {progress.xpToNextLevel} XP to level {progress.level + 1}
            </Text>
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

          {/* Field guide — the one place discoveries live. Previously this was
              two cards ("Field Guide" tiles and "Recent Discoveries" rows) both
              rendering creatures.slice(0, 4): the same animals, twice. */}
          <View style={styles.sectionCard}>
            <Pressable
              style={styles.sectionHeaderRow}
              onPress={() => {
                void Haptics.selectionAsync()
                setGuideOpen(true)
              }}
              accessibilityRole="button"
              accessibilityLabel="Open the field guide"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>FIELD GUIDE</Text>
                <Text style={styles.sectionSubtitle}>
                  {speciesMilestone.current} / {speciesMilestone.target} species discovered
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#9CA69D" />
            </Pressable>

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
                      {c.capturedAt
                        ? new Date(c.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : 'Today'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyDiscoveriesBox}>
                <Ionicons name="search-outline" size={26} color="#9CA69D" />
                <View style={styles.emptyCopy}>
                  <Text style={styles.emptyTitle}>Nothing discovered yet</Text>
                  <Text style={styles.emptySubtitle}>Your first real-world find will appear here.</Text>
                </View>
              </View>
            )}
          </View>

          {/* Compact Explorer Medals */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>EXPLORER MEDALS</Text>
            <View style={styles.compactMedalsRow}>
              {medals.map((m) => (
                <View key={m.id} style={styles.compactMedalCell}>
                  <Image source={m.icon} style={styles.compactMedalIcon} contentFit="contain" />
                  <Text style={styles.compactMedalTitle}>{m.title}</Text>
                  <Ionicons
                    name={m.unlocked ? 'checkmark-circle' : 'lock-closed-outline'}
                    size={14}
                    color={m.unlocked ? '#B7F34A' : '#9CA69D'}
                  />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Settings & Account Modal Sheet */}
      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <Pressable
                style={({ pressed }) => pressed && styles.pressedOpacity}
                onPress={() => setSettingsOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close settings"
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsContent}>
              <Text style={styles.modalSectionLabel}>GENERAL</Text>
              <View style={styles.modalSection}>
                <View style={styles.modalRow}>
                  <Ionicons name={soundOn ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color="#F5F2E9" />
                  <Text style={styles.modalRowText}>Sound effects</Text>
                  <Switch
                    value={soundOn}
                    onValueChange={(next) => {
                      void Haptics.selectionAsync()
                      setSoundOn(next)
                      void setMuted(!next)
                      if (next) playSound('lock-on')
                    }}
                    accessibilityLabel="Sound effects"
                    trackColor={{ false: '#4A544C', true: '#7FAF2E' }}
                    thumbColor="#F5F2E9"
                  />
                </View>
              </View>

              <Text style={styles.modalSectionLabel}>ACCOUNT</Text>
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} onPress={onSignOut}>
                  <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
                  <Text style={[styles.modalRowText, { color: '#EF4444' }]}>Sign Out</Text>
                </Pressable>
              </View>

              <Text style={styles.modalSectionLabel}>ABOUT</Text>
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} onPress={() => openExternal(AppConfig.privacyUrl)}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#AAB3AB" />
                  <Text style={styles.modalRowText}>Privacy Policy</Text>
                  <Ionicons name="open-outline" size={15} color="#68736A" />
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable style={styles.modalRow} onPress={() => openExternal(AppConfig.termsUrl)}>
                  <Ionicons name="document-text-outline" size={20} color="#AAB3AB" />
                  <Text style={styles.modalRowText}>Terms of Service</Text>
                  <Ionicons name="open-outline" size={15} color="#68736A" />
                </Pressable>

                {AppConfig.supportEmail ? (
                  <>
                    <View style={styles.modalDivider} />
                    <Pressable style={styles.modalRow} onPress={() => openExternal(`mailto:${AppConfig.supportEmail}`)}>
                      <Ionicons name="mail-outline" size={20} color="#AAB3AB" />
                      <Text style={styles.modalRowText}>Contact Support</Text>
                      <Ionicons name="chevron-forward" size={16} color="#68736A" />
                    </Pressable>
                  </>
                ) : null}
              </View>

              <Text style={styles.modalSectionLabel}>DATA</Text>
              <View style={styles.modalSection}>
                <Pressable style={styles.modalRow} disabled={deleting} onPress={onClearCollection}>
                  <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  <Text style={[styles.modalRowText, { color: '#EF4444' }]}>Delete Saved Collection</Text>
                </Pressable>

                <View style={styles.modalDivider} />

                <Pressable style={styles.modalRow} disabled={deleting} onPress={onDeleteAccount}>
                  <Ionicons name="warning-outline" size={20} color="#FF6B6B" />
                  <Text style={[styles.modalRowText, { color: '#EF4444' }]}>
                    {deleting ? 'Deleting...' : 'Delete Account Data'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FieldGuide visible={guideOpen} onClose={() => setGuideOpen(false)} creatures={creatures} />
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
    backgroundColor: 'rgba(15, 20, 17, 0.58)',
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 24,
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
    backgroundColor: 'rgba(15, 20, 17, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: '#182019',
  },
  namesColumn: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F5F2E9',
    letterSpacing: -0.3,
  },
  handleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#AAB3AB',
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B7F34A',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  compactXpCard: {
    paddingHorizontal: 4,
    gap: 8,
  },
  xpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  xpTitle: {
    fontSize: 10,
    fontWeight: '700',
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
    backgroundColor: 'rgba(245, 242, 233, 0.16)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#B7F34A',
    borderRadius: 3,
  },
  xpFootnote: {
    fontSize: 10,
    fontWeight: '600',
    color: '#AAB3AB',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F5F2E9',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B7F34A',
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(245, 242, 233, 0.16)',
  },
  sectionCard: {
    paddingHorizontal: 4,
    paddingTop: 20,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245, 242, 233, 0.16)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 36,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B7F34A',
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#AAB3AB',
    marginTop: 2,
  },
  recentList: {
    gap: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  recentPhotoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 20, 17, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 242, 233, 0.14)',
  },
  recentPhoto: {
    width: 40,
    height: 40,
  },
  recentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F5F2E9',
  },
  recentSpecies: {
    fontSize: 11,
    fontWeight: '600',
    color: '#AAB3AB',
  },
  recentTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA69D',
  },
  emptyDiscoveriesBox: {
    minHeight: 72,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F5F2E9',
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#AAB3AB',
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
    backgroundColor: 'rgba(15, 20, 17, 0.42)',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    gap: 4,
  },
  compactMedalIcon: {
    width: 34,
    height: 34,
    marginBottom: 2,
  },
  compactMedalTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F5F2E9',
    textAlign: 'center',
    lineHeight: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#182019',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderCurve: 'continuous',
    paddingHorizontal: 24,
    paddingTop: 20,
    maxHeight: '78%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 44,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F5F2E9',
  },
  doneText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#B7F34A',
  },
  settingsContent: {
    paddingBottom: 8,
    gap: 0,
  },
  modalSectionLabel: {
    marginTop: 16,
    marginBottom: 4,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: '#9CA69D',
  },
  modalSection: {
    paddingHorizontal: 4,
  },
  modalRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  modalRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#F5F2E9',
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 32,
    backgroundColor: 'rgba(245, 242, 233, 0.12)',
  },
  pressedOpacity: {
    opacity: 0.75,
  },
})
