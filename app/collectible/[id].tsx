import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { AppIcon } from '@/components/summon/app-icon'
import { CollectibleMark } from '@/components/summon/collectible-mark'
import { EmptyState } from '@/components/summon/empty-state'
import { theme } from '@/constants/theme'
import { collectibles } from '@/features/summon/catalog'
import { useSummon } from '@/features/summon/summon-provider'

/**
 * Collectible detail — lore, rarity, ownership, and related proofs.
 */
export default function CollectibleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { owned, pulls } = useSummon()
  const item = collectibles.find((x) => x.id === id)
  const entry = owned.find((x) => x.collectibleId === id)
  const relatedPulls = pulls.filter((p) => p.collectibleId === id)

  if (!item) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <AppIcon name="chevron.left" size={18} color={theme.colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <EmptyState icon="questionmark.circle" title="Relic not found" copy="This collectible id is unknown." />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <AppIcon name="chevron.left" size={18} color={theme.colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={[styles.hero, { backgroundColor: `${item.accent}66` }]}>
          <CollectibleMark id={item.id} mark={item.symbol} accent={item.accent} size={96} locked={!entry} />
        </View>

        <Text style={styles.rarity}>{entry ? item.rarity : 'Undiscovered'}</Text>
        <Text style={styles.name}>{entry ? item.name : 'Unknown relic'}</Text>
        <Text style={styles.lore}>{entry ? item.lore : 'Summon this relic to reveal its story.'}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>OWNED</Text>
            <Text style={styles.statValue}>{entry?.quantity ?? 0}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>PULLS</Text>
            <Text style={styles.statValue}>{relatedPulls.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>STATUS</Text>
            <Text style={styles.statValue}>{entry ? 'Yours' : 'Locked'}</Text>
          </View>
        </View>

        {relatedPulls.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Proofs</Text>
            {relatedPulls.map((pull) => (
              <View key={pull.id} style={styles.proofRow}>
                <View>
                  <Text style={styles.proofTitle}>Roll {pull.roll.toLocaleString()}</Text>
                  <Text style={styles.proofMeta}>
                    {new Date(pull.createdAt).toLocaleDateString()} · {pull.seed}
                  </Text>
                </View>
                <AppIcon name="checkmark.seal.fill" size={16} color={theme.colors.text} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="sparkles"
            title="No pulls yet"
            copy="When you summon this relic, its roll and seed will show up here."
          />
        )}

        {!entry ? (
          <Pressable style={styles.cta} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.ctaText}>Go summon</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  body: { padding: 24, gap: 12 },
  hero: {
    aspectRatio: 1.2,
    borderRadius: theme.radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rarity: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  lore: { color: theme.colors.textMuted, fontSize: 15, lineHeight: 22 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 8 },
  stat: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 14,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  section: { marginTop: 8, gap: 10 },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 18,
    fontWeight: '800',
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  proofTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  proofMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
  cta: {
    marginTop: 8,
    minHeight: 54,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
