import { useMemo } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { theme } from '@/constants/theme'
import { ANIMAL_PHOTOS, animalPhotoFor } from '@/lib/animal-images'
import { RARITY_COLOR, type Creature } from '@/lib/creatures'
import { buildFieldGuide } from '@/lib/field-guide'

/**
 * The regional field guide.
 *
 * Entries you have met are shown as the animal; entries you have not are shown
 * as a silhouette of the same photograph, so the shape of what is still out
 * there is visible without giving away the species. Catches the roster has no
 * artwork for are listed too — a real sighting is never hidden because the
 * guide happened not to know about it.
 */
export function FieldGuide({
  visible,
  onClose,
  creatures,
}: {
  visible: boolean
  onClose: () => void
  creatures: Creature[]
}) {
  const guide = useMemo(() => buildFieldGuide(creatures, ANIMAL_PHOTOS), [creatures])
  const progress = guide.total > 0 ? guide.discovered / guide.total : 0

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Field guide</Text>
            <Text style={styles.subtitle}>
              {guide.discovered} of {guide.total} species found
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync()
              onClose()
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close field guide"
          >
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {guide.entries.map((entry) => {
              const photo = animalPhotoFor(entry.species, entry.commonName)
              const found = entry.count > 0
              const creature = entry.creature
              return (
                <View key={entry.key} style={styles.tile}>
                  <View style={styles.photoBox}>
                    {photo ? (
                      <Image
                        source={photo.image}
                        style={[styles.photo, !found && styles.photoHidden]}
                        contentFit="cover"
                      />
                    ) : creature?.photoUri ? (
                      <Image
                        source={{ uri: creature.photoUri }}
                        style={[styles.photo, !found && styles.photoHidden]}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.photo, styles.photoFallback]}>
                        <Ionicons name="paw" size={26} color={found ? theme.colors.primary : '#3A443B'} />
                      </View>
                    )}

                    {found ? (
                      <>
                        <View style={[styles.rarityDot, { backgroundColor: RARITY_COLOR[entry.creature!.rarity] }]} />
                        {entry.count > 1 ? (
                          <View style={styles.countBadge}>
                            <Text style={styles.countText}>×{entry.count}</Text>
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <View style={styles.unknownBadge}>
                        <Ionicons name="help" size={18} color="#68736A" />
                      </View>
                    )}
                  </View>

                  <Text style={[styles.name, !found && styles.nameHidden]} numberOfLines={1}>
                    {found ? entry.commonName : 'Not yet found'}
                  </Text>
                  <Text style={styles.species} numberOfLines={1}>
                    {found ? entry.species : '—'}
                  </Text>
                </View>
              )
            })}
          </View>

          <View style={styles.footnote}>
            <Ionicons name="shield-checkmark-outline" size={15} color={theme.colors.textMuted} />
            <Text style={styles.footnoteText}>
              Silhouettes mark species you have not met yet. Summon never shows where an animal is — only what you have
              already found.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 },
  subtitle: { marginTop: 2, fontSize: 12, color: theme.colors.textMuted },
  done: { fontSize: 16, fontWeight: '700', color: theme.colors.primaryStrong },
  progressTrack: {
    marginHorizontal: 20,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceRaised,
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },
  content: { padding: 20, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: { width: '47%' },
  photoBox: {
    aspectRatio: 1,
    borderRadius: theme.radius.tile,
    overflow: 'hidden',
    backgroundColor: '#0F1411',
  },
  photo: { width: '100%', height: '100%' },
  photoHidden: { opacity: 0.14 },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  rarityDot: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(15, 20, 17, 0.6)',
  },
  countBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(15, 20, 17, 0.78)',
  },
  countText: { fontSize: 11, fontWeight: '900', color: '#F5F2E9', fontVariant: ['tabular-nums'] },
  unknownBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { marginTop: 8, fontSize: 13, fontWeight: '800', color: theme.colors.text },
  nameHidden: { color: theme.colors.textFaint, fontStyle: 'italic' },
  species: { marginTop: 1, fontSize: 11, fontStyle: 'italic', color: theme.colors.textMuted },
  footnote: {
    marginTop: 26,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  footnoteText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
})
