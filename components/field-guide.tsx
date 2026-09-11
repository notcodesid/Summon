import { useMemo } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { theme } from '@/constants/theme'
import { ANIMAL_PHOTOS, animalPhotoFor } from '@/lib/animal-images'
import { RARITY_LABEL, type Creature } from '@/lib/creatures'
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
  const discoveredEntries = guide.entries.filter((entry) => entry.count > 0)
  const tasks = guide.entries.filter((entry) => entry.count === 0)

  const startTask = () => {
    void Haptics.selectionAsync()
    onClose()
    router.push('/camera')
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close field guide"
        />
        <SafeAreaView style={styles.page} edges={['bottom']}>
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
            <Text style={styles.sectionLabel}>DISCOVERED</Text>
            <View style={styles.list}>
              {discoveredEntries.map((entry, index) => {
                const creature = entry.creature!
                const libraryPhoto = animalPhotoFor(entry.species, entry.commonName)
                const source = creature.photoUri ? { uri: creature.photoUri } : libraryPhoto?.image

                return (
                  <View key={entry.key} style={[styles.row, index > 0 && styles.rowBorder]}>
                    {source ? (
                      <Image
                        source={source}
                        style={styles.thumbnail}
                        contentFit="cover"
                        transition={160}
                        accessibilityLabel={`Photo of ${entry.commonName}`}
                      />
                    ) : (
                      <View style={[styles.thumbnail, styles.photoFallback]}>
                        <Ionicons name="paw" size={22} color={theme.colors.primaryStrong} />
                      </View>
                    )}
                    <View style={styles.rowCopy}>
                      <Text style={styles.name} numberOfLines={1}>
                        {entry.commonName}
                      </Text>
                      <Text style={styles.detail} numberOfLines={1}>
                        {RARITY_LABEL[creature.rarity]}
                        {entry.count > 1 ? ` · ${entry.count} found` : ''}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primaryStrong} />
                  </View>
                )
              })}
            </View>

            {tasks.length > 0 ? (
              <View style={styles.tasksSection}>
                <Text style={styles.sectionLabel}>TO FIND</Text>
                <View style={styles.list}>
                  {tasks.map((entry, index) => {
                    const photo = animalPhotoFor(entry.species, entry.commonName)
                    return (
                      <Pressable
                        key={entry.key}
                        onPress={startTask}
                        style={({ pressed }) => [
                          styles.taskRow,
                          index > 0 && styles.rowBorder,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Find ${entry.commonName}`}
                        accessibilityHint="Opens the camera"
                      >
                        {photo ? (
                          <Image source={photo.image} style={styles.taskThumbnail} contentFit="cover" />
                        ) : (
                          <View style={[styles.taskThumbnail, styles.photoFallback]}>
                            <Ionicons name="paw" size={18} color={theme.colors.textMuted} />
                          </View>
                        )}
                        <Text style={styles.taskName} numberOfLines={1}>
                          Find {entry.commonName}
                        </Text>
                        <Ionicons name="camera-outline" size={19} color={theme.colors.textMuted} />
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.42)' },
  page: {
    height: '68%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
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
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  sectionLabel: { ...theme.type.micro, color: theme.colors.textMuted, marginBottom: 8 },
  list: { overflow: 'hidden' },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  thumbnail: { width: 58, height: 58, borderRadius: 14, backgroundColor: theme.colors.surfaceRaised },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  detail: { fontSize: 13, color: theme.colors.textMuted, textTransform: 'capitalize' },
  tasksSection: { marginTop: 20 },
  taskRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceRaised,
    opacity: 0.72,
  },
  taskName: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.text },
  pressed: { opacity: 0.55 },
})
