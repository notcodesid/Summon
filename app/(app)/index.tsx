import { useCallback, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { AppConfig } from '@/constants/app-config'
import { theme } from '@/constants/theme'
import {
  Avatar,
  MicroLabel,
  PrimaryButton,
  QuietButton,
  RarityDot,
  Rule,
} from '@/components/ui'
import { loadCollection } from '@/lib/collection'
import { RARITY_ORDER, RARITY_COLOR, type Creature } from '@/lib/creatures'
import { isAuthBypassed, isPrivyConfigured } from '@/lib/privy-config'
import { usePlayerPhoto } from '@/lib/player-photo'
import { initialsFor, usePlayer } from '@/lib/use-player'

/**
 * Home reads as the front page of a field guide: what you've collected, your
 * rarest find, your latest catches, and one way forward.
 */
export default function HomeScreen() {
  if (isAuthBypassed || !isPrivyConfigured) {
    return <Home />
  }
  return <HomeAuthenticated />
}

function HomeAuthenticated() {
  const player = usePlayer()
  const { photoUrl } = usePlayerPhoto(player.privyUserId)

  return (
    <Home
      privyUserId={player.privyUserId}
      initials={initialsFor(player)}
      photoUrl={photoUrl}
      showProfile
    />
  )
}

const RECENT_LIMIT = 6

function Home({
  privyUserId,
  initials = '?',
  photoUrl,
  showProfile = false,
}: {
  privyUserId?: string
  initials?: string
  photoUrl?: string | null
  showProfile?: boolean
}) {
  const [creatures, setCreatures] = useState<Creature[]>([])

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

  const rarest = rarestOf(creatures)
  const recent = creatures.slice(0, RECENT_LIMIT)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.masthead}>
          <Text style={styles.wordmark}>{AppConfig.name}</Text>
          {showProfile ? (
            <Avatar
              initials={initials}
              uri={photoUrl}
              size={42}
              onPress={() => router.push('/profile')}
              accessibilityLabel="Open your profile"
            />
          ) : null}
        </View>

        <Rule style={styles.mastheadRule} />

        <View style={styles.index}>
          <View style={styles.indexCount}>
            <Text style={styles.numeral}>{creatures.length}</Text>
            <MicroLabel>
              {creatures.length === 1 ? 'species' : 'species'} collected
            </MicroLabel>
          </View>

          <View style={styles.indexRarest}>
            <MicroLabel>rarest find</MicroLabel>
            {rarest ? (
              <View style={styles.rarestRow}>
                <RarityDot color={RARITY_COLOR[rarest.rarity]} />
                <Text style={styles.rarestName} numberOfLines={1}>
                  {rarest.commonName}
                </Text>
              </View>
            ) : (
              <Text style={styles.rarestEmpty}>—</Text>
            )}
          </View>
        </View>

        <Rule />

        {recent.length > 0 ? (
          <View style={styles.recent}>
            <MicroLabel>recent</MicroLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRow}
            >
              {recent.map((creature) => (
                <Pressable
                  key={creature.id}
                  onPress={() => router.push('/collection')}
                  accessibilityRole="button"
                  accessibilityLabel={creature.commonName}
                >
                  <Image
                    source={{ uri: creature.photoUri }}
                    style={styles.thumb}
                  />
                  <View
                    style={[
                      styles.thumbBar,
                      { backgroundColor: RARITY_COLOR[creature.rarity] },
                    ]}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          // Centred so the space around it reads as deliberate, not as a gap
          // waiting for content.
          <View style={styles.empty}>
            <MicroLabel>field guide empty</MicroLabel>
            <Text style={styles.emptyLine}>
              go outside, find an animal, and point the camera at it.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <PrimaryButton
            label="scan"
            onPress={() => router.push('/camera')}
            accessibilityLabel="Open camera to scan an animal"
          />
          <View style={styles.footerLinks}>
            <QuietButton
              label="collection"
              onPress={() => router.push('/collection')}
              accessibilityLabel="Open collection"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

function rarestOf(creatures: Creature[]): Creature | undefined {
  return creatures.reduce<Creature | undefined>((best, creature) => {
    if (!best) return creature
    return RARITY_ORDER.indexOf(creature.rarity) > RARITY_ORDER.indexOf(best.rarity)
      ? creature
      : best
  }, undefined)
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.xxl,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: theme.type.display.fontSize,
    fontWeight: theme.type.display.fontWeight,
    letterSpacing: theme.type.display.letterSpacing,
    color: theme.colors.text,
  },
  mastheadRule: {
    marginTop: theme.space.xl,
  },
  index: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: theme.space.xl,
  },
  indexCount: {
    gap: theme.space.xs,
  },
  numeral: {
    fontSize: theme.type.numeral.fontSize,
    fontWeight: theme.type.numeral.fontWeight,
    letterSpacing: theme.type.numeral.letterSpacing,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  indexRarest: {
    alignItems: 'flex-end',
    gap: theme.space.sm,
    maxWidth: '52%',
  },
  rarestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  rarestName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    flexShrink: 1,
  },
  rarestEmpty: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textFaint,
  },
  recent: {
    flex: 1,
    paddingTop: theme.space.xl,
    gap: theme.space.md,
  },
  recentRow: {
    gap: theme.space.md,
    paddingRight: theme.space.xl,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.colors.surfaceRaised,
  },
  thumbBar: {
    marginTop: 6,
    height: 3,
    width: 22,
    borderRadius: 999,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.space.md,
  },
  emptyLine: {
    fontSize: 17,
    lineHeight: 25,
    color: theme.colors.text,
    maxWidth: 260,
  },
  footer: {
    gap: theme.space.lg,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xl,
  },
})
