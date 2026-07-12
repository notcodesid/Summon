import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { ScreenShell } from '@/components/summon/screen-shell'
import { WalletPill } from '@/components/summon/wallet-pill'
import { AppIcon } from '@/components/summon/app-icon'
import { CollectibleMark } from '@/components/summon/collectible-mark'
import { EmptyState } from '@/components/summon/empty-state'
import { LoadingState } from '@/components/summon/loading-state'
import { theme } from '@/constants/theme'
import { collectibles } from '@/features/summon/mock-summon-repository'
import { useSummon } from '@/features/summon/summon-provider'

export default function ProofScreen() {
  const { pulls, loading } = useSummon()

  return (
    <ScreenShell title="Proof" eyebrow="Verifiable pull history" action={<WalletPill />}>
      <View style={styles.info}>
        <View style={styles.infoIcon}>
          <AppIcon name="checkmark.shield.fill" size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.infoTitle}>Fairness you can inspect</Text>
        <Text style={styles.infoCopy}>
          Every outcome includes its random roll, seed and settlement signature. The same fields
          will be populated by VRF and the Ephemeral Rollup.
        </Text>
      </View>

      {loading ? (
        <LoadingState label="Loading proofs…" />
      ) : pulls.length === 0 ? (
        <EmptyState
          icon="checkmark.shield"
          title="No proofs yet"
          copy="Summon a relic and every roll, seed, and signature will land here."
        />
      ) : (
        <View style={styles.list}>
          {pulls.map((pull) => {
            const item = collectibles.find((x) => x.id === pull.collectibleId)!
            return (
              <Pressable
                key={pull.id}
                style={styles.card}
                accessibilityRole="button"
                onPress={() => router.push(`/collectible/${item.id}`)}
              >
                <View style={styles.row}>
                  <CollectibleMark mark={item.symbol} accent={item.accent} size={50} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.date}>
                      {new Date(pull.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.status}>
                    <AppIcon name="checkmark" size={12} color={theme.colors.text} weight="bold" />
                    <Text style={styles.statusText}>Verified</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.metrics}>
                  <View>
                    <Text style={styles.label}>ROLL</Text>
                    <Text style={styles.value}>{pull.roll.toLocaleString()}</Text>
                  </View>
                  <View>
                    <Text style={styles.label}>SEED</Text>
                    <Text style={styles.value}>{pull.seed}</Text>
                  </View>
                  <View>
                    <Text style={styles.label}>SIGNATURE</Text>
                    <Text style={styles.value}>{pull.signature}</Text>
                  </View>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  info: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.text,
    padding: 22,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontFamily: theme.font.display,
    fontSize: 18,
    fontWeight: '800',
  },
  infoCopy: { color: '#C8C8C5', fontSize: 13, lineHeight: 20, marginTop: 8 },
  list: { gap: 12 },
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: '#FFFFFF',
    padding: 16,
    boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  date: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
  status: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: { color: theme.colors.text, fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 14 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between' },
  label: {
    color: theme.colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.6,
    fontWeight: '800',
    marginBottom: 4,
  },
  value: {
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    fontWeight: '700',
  },
})
