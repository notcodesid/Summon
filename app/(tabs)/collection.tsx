import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { ScreenShell } from '@/components/summon/screen-shell'
import { WalletPill } from '@/components/summon/wallet-pill'
import { CollectibleMark } from '@/components/summon/collectible-mark'
import { EmptyState } from '@/components/summon/empty-state'
import { LoadingState } from '@/components/summon/loading-state'
import { theme } from '@/constants/theme'
import { collectibles } from '@/features/summon/mock-summon-repository'
import { useSummon } from '@/features/summon/summon-provider'
import { Rarity } from '@/features/summon/types'

const filters: ('All' | Rarity)[] = ['All', 'Common', 'Rare', 'Epic', 'Legendary']

export default function CollectionScreen() {
  const { owned, loading } = useSummon()
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')

  const visible = collectibles.filter((x) => filter === 'All' || x.rarity === filter)

  return (
    <ScreenShell
      title="Collection"
      action={<WalletPill />}
    >
      {loading ? (
        <LoadingState label="Loading collection…" />
      ) : (
        <>
          <View style={styles.filters}>
            {filters.map((x) => (
              <Pressable
                accessibilityRole="button"
                key={x}
                onPress={() => setFilter(x)}
                style={[styles.filter, filter === x && styles.filterActive]}
              >
                <Text style={[styles.filterText, filter === x && styles.filterTextActive]}>{x}</Text>
              </Pressable>
            ))}
          </View>

          {visible.length === 0 ? (
            <EmptyState
              icon="square.grid.2x2"
              title="Nothing in this filter"
              copy="Try another rarity tier or summon a new relic."
            />
          ) : (
            <View style={styles.grid}>
              {visible.map((item) => {
                const entry = owned.find((x) => x.collectibleId === item.id)
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/collectible/${item.id}`)}
                    style={[styles.card, !entry && styles.locked]}
                  >
                    <View
                      style={[
                        styles.art,
                        { backgroundColor: entry ? `${item.accent}55` : theme.colors.surface },
                      ]}
                    >
                      <CollectibleMark
                        id={item.id}
                        mark={item.symbol}
                        accent={item.accent}
                        size={72}
                        locked={!entry}
                      />
                    </View>
                    <Text style={styles.rarity}>{entry ? item.rarity : 'Undiscovered'}</Text>
                    <Text numberOfLines={1} style={styles.name}>
                      {entry ? item.name : 'Unknown relic'}
                    </Text>
                    {entry && entry.quantity > 1 ? (
                      <View style={styles.count}>
                        <Text style={styles.countText}>×{entry.quantity}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                )
              })}
            </View>
          )}
        </>
      )}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  filterActive: { backgroundColor: theme.colors.text },
  filterText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    position: 'relative',
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.card,
    padding: 10,
    boxShadow: '0 2px 16px rgba(0,0,0,0.045)',
  },
  locked: { opacity: 0.48 },
  art: {
    aspectRatio: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  rarity: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.font.body,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  count: {
    position: 'absolute',
    top: 18,
    right: 18,
    borderRadius: theme.radius.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countText: { color: theme.colors.text, fontSize: 11, fontWeight: '800' },
})
