import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { ScreenShell } from '@/components/summon/screen-shell'
import { WalletPill } from '@/components/summon/wallet-pill'
import { AppIcon } from '@/components/summon/app-icon'
import { CollectibleMark } from '@/components/summon/collectible-mark'
import { theme } from '@/constants/theme'
import { collectibles } from '@/features/summon/mock-summon-repository'
import { useSummon } from '@/features/summon/summon-provider'
import { PullRecord } from '@/features/summon/types'

export default function SummonScreen() {
  const { summon, summoning, pulls } = useSummon()
  const [result, setResult] = useState<PullRecord | null>(null)
  const item = result ? collectibles.find((x) => x.id === result.collectibleId) : null
  const latest = pulls[0] ? collectibles.find((x) => x.id === pulls[0].collectibleId) : null

  return (
    <ScreenShell title="Summon" eyebrow="Season I · The First Light" action={<WalletPill />}>
      <View style={styles.hero}>
        <View style={styles.orbit}>
          <View style={styles.core}>
            <AppIcon name="sparkles" size={44} color={theme.colors.text} weight="semibold" />
          </View>
        </View>
        <Text style={styles.heroTitle}>Something lovely{`\n`}is waiting.</Text>
        <Text style={styles.heroCopy}>
          Every summon is verifiably random and becomes part of your collection.
        </Text>
        <Pressable
          disabled={summoning}
          accessibilityRole="button"
          onPress={async () => setResult(await summon())}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, summoning && styles.disabled]}
        >
          {summoning ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>Summon now</Text>
              <Text style={styles.buttonMeta}>1 pull</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.odds}>Common 60% · Rare 30% · Epic 9% · Legendary 1%</Text>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Latest discovery</Text>
        <Text style={styles.sectionMeta}>{pulls.length} pulls</Text>
      </View>

      <View style={styles.latest}>
        {latest && pulls[0] ? (
          <>
            <CollectibleMark mark={latest.symbol} accent={latest.accent} size={54} />
            <View style={{ flex: 1 }}>
              <Text style={styles.latestName}>{latest.name}</Text>
              <Text style={styles.latestRarity}>{latest.rarity} · Verified</Text>
            </View>
            <AppIcon name="chevron.right" size={16} color={theme.colors.textMuted} />
          </>
        ) : (
          <Text style={styles.heroCopy}>Your first discovery will appear here.</Text>
        )}
      </View>

      <Modal visible={!!result} animationType="fade" transparent onRequestClose={() => setResult(null)}>
        <View style={styles.modal}>
          <Text style={styles.revealOverline}>YOU SUMMONED</Text>
          {item ? <CollectibleMark mark={item.symbol} accent={item.accent} size={96} /> : null}
          <Text style={styles.revealRarity}>{item?.rarity}</Text>
          <Text style={styles.revealName}>{item?.name}</Text>
          <Text style={styles.revealLore}>{item?.lore}</Text>
          <View style={styles.verified}>
            <AppIcon name="checkmark.seal.fill" size={14} color={theme.colors.text} />
            <Text style={styles.verifiedText}>Roll {result?.roll.toLocaleString()} · Verified</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setResult(null)}
            style={styles.continueButton}
          >
            <Text style={styles.continueText}>Add to collection</Text>
          </Pressable>
        </View>
      </Modal>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 18 },
  orbit: {
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  core: {
    width: 120,
    height: 120,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 40px rgba(0,0,0,0.07)',
  },
  heroTitle: {
    color: theme.colors.text,
    textAlign: 'center',
    fontFamily: theme.font.display,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroCopy: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontFamily: theme.font.body,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 310,
    marginTop: 12,
  },
  button: {
    marginTop: 28,
    width: '100%',
    minHeight: 60,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: theme.font.body,
    fontSize: 17,
    fontWeight: '800',
  },
  buttonMeta: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', opacity: 0.65 },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.7 },
  odds: { color: theme.colors.textMuted, fontSize: 11, marginTop: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 19,
    fontWeight: '800',
  },
  sectionMeta: { color: theme.colors.textMuted, fontSize: 13 },
  latest: {
    minHeight: 88,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  latestName: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  latestRarity: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(252,252,251,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  revealOverline: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  revealRarity: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  revealName: {
    color: theme.colors.text,
    fontFamily: theme.font.display,
    fontSize: 30,
    fontWeight: '800',
  },
  revealLore: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  verifiedText: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  continueButton: {
    marginTop: 16,
    minHeight: 54,
    width: '100%',
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
})
