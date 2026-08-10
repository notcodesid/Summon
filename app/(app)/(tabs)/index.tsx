import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { theme } from '@/constants/theme'
import { loadCollection } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import { latestDiscovery } from '@/lib/discovery-library'
import { usePlayer } from '@/lib/use-player'

export default function HomeScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const { privyUserId } = usePlayer()
  const insets = useSafeAreaInsets()

  useFocusEffect(
    useCallback(() => {
      let active = true
      void loadCollection(privyUserId).then((next) => {
        if (active) setCreatures(next)
      })
      return () => {
        active = false
      }
    }, [privyUserId]),
  )

  if (creatures === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    )
  }

  const recent = latestDiscovery(creatures)

  return (
    <View style={styles.container}>
      {/* Full-Screen Outdoor Wild Sanctuary Background */}
      <ImageBackground
        source={require('@/assets/sanctuary.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      {/* Floating Bottom Overlays */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 115 }]}>
        {/* Scanned Lead Specimen Card (Only when animals exist) */}
        {recent ? (
          <View style={styles.heroCard}>
            <View style={styles.heroCardHeader}>
              <Text style={styles.heroCardBadge}>LEAD COMPANION</Text>
              <View style={styles.rarityPill}>
                <Text style={styles.rarityText}>{recent.rarity.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.heroBody}>
              {recent.photoUri ? (
                <Image source={{ uri: recent.photoUri }} style={styles.heroPhoto} contentFit="cover" />
              ) : (
                <View style={styles.heroPhotoPlaceholder}>
                  <Ionicons name="paw" size={32} color={theme.colors.primary} />
                </View>
              )}
              <View style={styles.heroMeta}>
                <Text style={styles.heroName}>{recent.commonName || recent.species}</Text>
                <Text style={styles.heroSpecies}>{recent.species}</Text>
                {recent.stats ? (
                  <View style={styles.statChips}>
                    <Text style={styles.statChip}>⚡ {recent.stats.attack} ATK</Text>
                    <Text style={styles.statChip}>🛡️ {recent.stats.defense} DEF</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Primary Scan Camera Circular CTA floating above tabs */}
        <Pressable
          style={({ pressed }) => [styles.scanCircleBtn, pressed && styles.scanBtnPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/camera')
          }}
        >
          <Ionicons name="camera" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#61B6A9',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  heroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroCardBadge: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#2F7D5B',
  },
  rarityPill: {
    backgroundColor: '#DDEFF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#2B6F93',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroPhoto: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  heroPhotoPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#EAEFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: {
    flex: 1,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#22332D',
  },
  heroSpecies: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#768E85',
    marginTop: 1,
  },
  statChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statChip: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2F7D5B',
    backgroundColor: '#EAEFEA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scanCircleBtn: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2F7D5B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  scanBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.95 }],
  },
})







