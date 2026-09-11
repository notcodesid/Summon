import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { LevelUpBanner } from '@/components/level-up-banner'
import { SpecimenCard } from '@/components/specimen-card'
import { theme } from '@/constants/theme'
import { playSound } from '@/lib/audio'
import { bondProgress } from '@/lib/bond'
import { loadCollection, saveBondLevel } from '@/lib/collection'
import type { Creature } from '@/lib/creatures'
import {
  EMPTY_EXPEDITION_LOG,
  expeditionXpTotal,
  isExpeditionCompleteToday,
  loadAnnouncedLevel,
  loadExpeditionLog,
  pendingExpedition,
  recordExpedition,
  saveAnnouncedLevel,
  type ExpeditionLog,
} from '@/lib/expedition-log'
import { dailyMission, discoveryStreak, HABITATS, suggestedHabitat } from '@/lib/expeditions'
import {
  captureXpFor,
  explorerProgress,
  unlockedDecorations,
  unlocksBetween,
  type ExplorerUnlock,
} from '@/lib/progression'
import { weeklyDiscoveryPrompt } from '@/lib/discovery-library'
import { setPendingBattle } from '@/lib/pending-battle'
import {
  clampToBounds,
  homePositionFor,
  loadPlacements,
  loadSanctuaryLife,
  savePlacement,
  saveSanctuaryLife,
  type SanctuaryBounds,
  type SanctuaryPlacements,
  type SanctuaryPoint,
  type SanctuaryLifeState,
} from '@/lib/sanctuary'
import { daysTogether, interactionMessage, localDayKey, sanctuaryBehavior } from '@/lib/sanctuary-life'
import { usePlayer } from '@/lib/use-player'

function DraggableCompanion({
  creature,
  initialPos,
  onInspect,
  onMoved,
  active,
  reduceMotion,
  socialOffset,
}: {
  creature: Creature
  initialPos: SanctuaryPoint
  onInspect: (creature: Creature) => void
  onMoved: (creature: Creature, point: SanctuaryPoint) => void
  active: boolean
  reduceMotion: boolean
  socialOffset?: SanctuaryPoint
}) {
  const pan = useRef(new Animated.ValueXY(initialPos)).current
  const scale = useRef(new Animated.Value(1)).current
  const bounceAnim = useRef(new Animated.Value(0)).current
  const drift = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const behavior = sanctuaryBehavior(creature)

  useEffect(() => {
    if (!active || reduceMotion || behavior.activity === 'sleeping') {
      drift.stopAnimation()
      drift.setValue({ x: 0, y: 0 })
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const wander = () => {
      if (cancelled) return
      const distance = behavior.activity === 'playing' ? 22 : 12
      Animated.spring(drift, {
        toValue: {
          x: (socialOffset?.x ?? 0) + (Math.random() - 0.5) * distance * 2,
          y: (socialOffset?.y ?? 0) + (Math.random() - 0.5) * distance,
        },
        damping: 20,
        stiffness: 45,
        mass: 1,
        useNativeDriver: false,
      }).start()
      timer = setTimeout(wander, 5000 + Math.random() * 4000)
    }
    timer = setTimeout(wander, 800 + Math.random() * 1800)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      drift.stopAnimation()
    }
  }, [active, behavior.activity, drift, reduceMotion, socialOffset?.x, socialOffset?.y])

  const triggerPettingAnimation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Bounce physics
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: -18, duration: 110, useNativeDriver: false }),
      Animated.spring(bounceAnim, { toValue: 0, friction: 4, tension: 180, useNativeDriver: false }),
    ]).start()
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        })
        pan.setValue({ x: 0, y: 0 })
        Animated.spring(scale, {
          toValue: 1.18,
          friction: 6,
          useNativeDriver: false,
        }).start()
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (e, gestureState) => {
        pan.flattenOffset()
        // Remember where the player put it, so the sanctuary keeps its arrangement.
        onMoved(creature, {
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        })
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          useNativeDriver: false,
        }).start()

        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          triggerPettingAnimation()
          onInspect(creature)
        }
      },
    }),
  ).current

  const imageUri = creature.cutoutUri || creature.photoUri

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.draggableFrame,
        {
          opacity: behavior.activity === 'sleeping' ? 0.86 : 1,
          transform: [
            { translateX: Animated.add(pan.x, drift.x) },
            { translateY: Animated.add(Animated.add(pan.y, drift.y), bounceAnim) },
            { scale },
          ],
        },
      ]}
    >
      <View style={styles.companionFrame}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={creature.cutoutUri ? styles.companionCutoutImg : styles.companionAvatarPhoto}
            contentFit={creature.cutoutUri ? 'contain' : 'cover'}
          />
        ) : (
          <Image
            source={require('@/assets/tab-icons-transparent/profile.png')}
            style={styles.companionMascotImg}
            contentFit="contain"
          />
        )}
      </View>
    </Animated.View>
  )
}

export default function HomeScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null)
  const [placements, setPlacements] = useState<SanctuaryPlacements>({})
  const [inspectedCreature, setInspectedCreature] = useState<Creature | null>(null)
  const [expeditionOpen, setExpeditionOpen] = useState(false)
  const [life, setLife] = useState<SanctuaryLifeState>({ interactionDays: {} })
  const [reduceMotion, setReduceMotion] = useState(false)
  const [arrivalName, setArrivalName] = useState<string | null>(null)
  const [expeditionLog, setExpeditionLog] = useState<ExpeditionLog>(EMPTY_EXPEDITION_LOG)
  const [levelUp, setLevelUp] = useState<{ level: number; unlocks: ExplorerUnlock[] } | null>(null)
  const { privyUserId } = usePlayer()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const isFocused = useIsFocused()

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => subscription.remove()
  }, [])

  // Anchored at 52% of the screen; this band keeps companions on the meadow
  // between the horizon and the scan button rather than up in the sky.
  const bounds: SanctuaryBounds = {
    halfWidth: Math.min(width / 2 - 48, 152),
    top: -10,
    bottom: 175,
    // Only the avatar's lower body is protected: half his width, plus a
    // companion's radius, plus margin. Companions near his head may overlap —
    // drawn behind him, that reads as distance rather than collision.
    reserved: { halfWidth: 88, top: 80, bottom: 175 },
  }

  useFocusEffect(
    useCallback(() => {
      let active = true
      void (async () => {
        const [next, saved, savedLife, savedLog] = await Promise.all([
          loadCollection(privyUserId),
          loadPlacements(privyUserId),
          loadSanctuaryLife(privyUserId),
          loadExpeditionLog(privyUserId),
        ])
        if (!active) return

        setCreatures(next)
        setPlacements(saved)

        const latest = [...next].sort((a, b) => b.capturedAt - a.capturedAt)[0]
        if (latest && savedLife.lastSeenCreatureId && latest.id !== savedLife.lastSeenCreatureId) {
          setArrivalName(latest.nickname || latest.commonName)
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }
        const updatedLife = { ...savedLife, lastSeenCreatureId: latest?.id ?? savedLife.lastSeenCreatureId }
        setLife(updatedLife)
        void saveSanctuaryLife(privyUserId, updatedLife)

        // The expedition pays out here, once, on the first open after it is
        // met. Nothing is awarded for a session that has no signed-in player.
        const finished = privyUserId ? pendingExpedition(next, savedLog) : null
        const recorded = finished ? await recordExpedition(privyUserId, savedLog, finished) : savedLog
        if (!active) return
        setExpeditionLog(recorded)

        // Then celebrate any level gained, whatever earned it — a well-framed
        // photo counts the same as a finished expedition here.
        const level = explorerProgress(captureXpFor(next) + expeditionXpTotal(recorded)).level
        const announced = await loadAnnouncedLevel(privyUserId)
        if (!active) return
        if (level > announced) {
          setLevelUp({ level, unlocks: unlocksBetween(announced, level) })
        } else if (finished) {
          // The banner plays its own sting, so the quieter expedition chime
          // only sounds when there is no level-up to celebrate.
          playSound('expedition')
        }
        if (privyUserId && level !== announced) {
          void saveAnnouncedLevel(privyUserId, level)
        }
      })()
      return () => {
        active = false
      }
    }, [privyUserId]),
  )

  const onCompanionMoved = (creature: Creature, point: SanctuaryPoint) => {
    setPlacements((prev) => ({ ...prev, [creature.id]: point }))
    void savePlacement(privyUserId, creature.id, point)
  }

  const today = localDayKey()
  const todaysInteractions = life.interactionDays[today] ?? []
  const interactWithCreature = () => {
    if (!inspectedCreature || todaysInteractions.includes(inspectedCreature.id)) return
    const next: SanctuaryLifeState = {
      ...life,
      interactionDays: {
        ...life.interactionDays,
        [today]: [...todaysInteractions, inspectedCreature.id],
      },
    }
    setLife(next)
    void saveSanctuaryLife(privyUserId, next)
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // The interaction log is the real measure of a bond; the stored level is
    // just so it survives a reinstall. Pushed on every visit so a failed call
    // is corrected by the next one.
    const days = daysTogether(next, inspectedCreature.id)
    void saveBondLevel(inspectedCreature.id, bondProgress(days).level)
  }

  if (creatures === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    )
  }

  // Oldest-first arrival order: a new catch appends instead of reshuffling
  // everyone already living here.
  const arrivalOrder = new Map(
    [...creatures].sort((a, b) => a.capturedAt - b.capturedAt).map((creature, index) => [creature.id, index]),
  )

  // Painter's order: companions lower on the meadow draw in front, so any
  // overlap reads as depth instead of collision.
  const placed = creatures
    .map((creature) => ({
      creature,
      position: placements[creature.id]
        ? clampToBounds(placements[creature.id], bounds)
        : homePositionFor(creature.id, arrivalOrder.get(creature.id) ?? 0, bounds),
    }))
    .sort((a, b) => a.position.y - b.position.y)
  const mission = dailyMission(creatures)
  const missionProgress = mission.current / mission.target
  const streak = discoveryStreak(creatures)
  const suggested = suggestedHabitat()
  const progress = explorerProgress(captureXpFor(creatures) + expeditionXpTotal(expeditionLog))
  const expeditionDone = isExpeditionCompleteToday(expeditionLog)
  const decorations = unlockedDecorations(progress.level)
  const selectedInteracted = inspectedCreature ? todaysInteractions.includes(inspectedCreature.id) : false
  const trailFocus = todaysInteractions.length
  const selectedBond = bondProgress(inspectedCreature ? daysTogether(life, inspectedCreature.id) : 0)

  return (
    <View style={styles.container}>
      {/* Full-Screen Outdoor Sanctuary Background */}
      <Image source={require('@/assets/sanctuary.jpg')} style={StyleSheet.absoluteFillObject} contentFit="cover" />

      <View style={styles.decorationsLayer} pointerEvents="none">
        {decorations.map((decoration, index) => (
          <View
            key={decoration.key}
            style={[
              styles.decoration,
              index === 0 ? styles.decorationLeft : index === 1 ? styles.decorationRight : styles.decorationCenter,
            ]}
          >
            <Ionicons name={decoration.icon as keyof typeof Ionicons.glyphMap} size={22} color="#F5F2E9" />
          </View>
        ))}
      </View>

      {arrivalName ? (
        <Pressable
          onPress={() => setArrivalName(null)}
          style={[styles.arrivalBanner, { top: insets.top + 148 }]}
          accessibilityRole="button"
          accessibilityLabel={`${arrivalName} arrived. Dismiss`}
        >
          <Ionicons name="sparkles" size={16} color="#171A17" />
          <Text style={styles.arrivalText}>{arrivalName} joined the sanctuary</Text>
        </Pressable>
      ) : null}

      <View style={[styles.expeditionHud, { top: insets.top + 12 }]}>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync()
            setExpeditionOpen(true)
          }}
          style={({ pressed }) => [styles.expeditionCard, pressed && styles.pressedOpacity]}
          accessibilityRole="button"
          accessibilityLabel={
            expeditionDone
              ? `Today's expedition complete. ${mission.rewardXp} experience earned. Explorer level ${progress.level}`
              : `Today's expedition: ${mission.prompt}, ${mission.current} of ${mission.target}`
          }
        >
          <View style={styles.expeditionTopRow}>
            <View style={styles.expeditionIcon}>
              <Ionicons name="compass" size={20} color="#171A17" />
            </View>
            <View style={styles.expeditionCopy}>
              <Text style={styles.expeditionEyebrow}>TODAY&apos;S EXPEDITION</Text>
              <Text style={styles.expeditionTitle}>{mission.title}</Text>
            </View>
            <View style={styles.levelChip}>
              <Text style={styles.levelChipText}>LV {progress.level}</Text>
            </View>
            <View style={styles.streakPill}>
              <Ionicons name="flame" size={14} color="#C9A66B" />
              <Text style={styles.streakText}>{streak}</Text>
              <View style={styles.hudDivider} />
              <Ionicons name="sparkles" size={13} color={theme.colors.primary} />
              <Text style={styles.streakText}>{trailFocus}</Text>
            </View>
          </View>
          <Text style={styles.expeditionPrompt} numberOfLines={1}>
            {mission.prompt}
          </Text>
          <View style={styles.missionProgressRow}>
            <View style={styles.missionTrack}>
              <View
                style={[
                  styles.missionFill,
                  expeditionDone && styles.missionFillDone,
                  { width: `${Math.round(Math.min(1, Math.max(0, missionProgress)) * 100)}%` },
                ]}
              />
            </View>
            {expeditionDone ? (
              <Text style={styles.missionCountDone}>+{mission.rewardXp} XP</Text>
            ) : (
              <Text style={styles.missionCount}>
                {mission.current}/{mission.target}
              </Text>
            )}
          </View>

          {/* Explorer XP sits under the mission bar rather than in the tab bar:
              the expedition is what earns it, so they belong together. */}
          <View style={styles.xpFooter}>
            <Text style={styles.xpFooterLabel}>EXPLORER</Text>
            <View style={styles.xpFooterTrack}>
              <View
                style={[
                  styles.xpFooterFill,
                  { width: `${Math.round(Math.min(1, Math.max(0, progress.progress)) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.xpFooterValue}>
              {progress.xpIntoLevel}/{progress.xpForLevel}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Interactive Drag & Drop Sanctuary Habitat Area */}
      <View style={styles.habitatCompanionArea} pointerEvents="box-none">
        {placed.map(({ creature, position }) => {
          const compatible = placed.find(
            (candidate) =>
              candidate.creature.id !== creature.id &&
              Boolean(creature.personality?.habitatAffinity) &&
              candidate.creature.personality?.habitatAffinity === creature.personality?.habitatAffinity,
          )
          const socialOffset = compatible
            ? {
                x: Math.max(-20, Math.min(20, (compatible.position.x - position.x) * 0.16)),
                y: Math.max(-10, Math.min(10, (compatible.position.y - position.y) * 0.12)),
              }
            : undefined
          return (
            <DraggableCompanion
              key={creature.id}
              creature={creature}
              initialPos={position}
              onInspect={(c) => setInspectedCreature(c)}
              onMoved={onCompanionMoved}
              active={isFocused}
              reduceMotion={reduceMotion}
              socialOffset={socialOffset}
            />
          )
        })}
      </View>

      {/* The player, standing in their own sanctuary. Drawn above the companions
          so any behind it read as distance; never intercepts touches, so a
          companion partly hidden by it is still draggable. */}
      <Image
        source={require('@/assets/onboarding-greeting.png')}
        style={[styles.playerAvatar, { bottom: insets.bottom + 238 }]}
        contentFit="contain"
        pointerEvents="none"
      />

      {/* Floating Bottom Overlays */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 115 }]} pointerEvents="box-none">
        {/* Primary scan CTA floating above the tabs */}
        <Pressable
          style={({ pressed }) => [styles.scanCircleBtn, pressed && styles.scanBtnPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/camera')
          }}
          accessibilityRole="button"
          accessibilityLabel="Scan an animal"
        >
          <Image source={require('@/assets/scan-lens.png')} style={styles.scanLensImg} contentFit="contain" />
        </Pressable>
      </View>

      {/* 2.5D Specimen Companion Inspection Modal */}
      <Modal
        visible={Boolean(inspectedCreature)}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectedCreature(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInspectedCreature(null)} />
          {inspectedCreature ? (
            <View style={[styles.inspectModalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={styles.inspectHeader}>
                <Text style={styles.inspectTitle}>Companion Specimen</Text>
                <Pressable
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                  onPress={() => setInspectedCreature(null)}
                >
                  <Ionicons name="close" size={20} color="#F5F2E9" />
                </Pressable>
              </View>

              <SpecimenCard creature={{ ...inspectedCreature, bondLevel: selectedBond.level }} />
              <View style={styles.lifePanel}>
                <View style={styles.lifeStatusRow}>
                  <View>
                    <Text style={styles.lifeLabel}>MOOD</Text>
                    <Text style={styles.lifeValue}>{sanctuaryBehavior(inspectedCreature).mood}</Text>
                  </View>
                  <View style={styles.lifeStatusRight}>
                    <Text style={styles.lifeLabel}>BOND</Text>
                    <Text style={styles.lifeValue}>{selectedBond.label}</Text>
                  </View>
                </View>
                <Text style={styles.lifeMessage}>{interactionMessage(inspectedCreature)}</Text>

                {/* Bond is earned by days spent together, so it shows its work
                    rather than appearing as an unexplained number. */}
                <View style={styles.bondRow}>
                  <View style={styles.bondTrack}>
                    <View style={[styles.bondFill, { width: `${Math.round(selectedBond.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.bondHint}>
                    {selectedBond.nextLabel
                      ? `${selectedBond.daysToNextLevel} more ${
                          selectedBond.daysToNextLevel === 1 ? 'day' : 'days'
                        } to ${selectedBond.nextLabel}`
                      : 'as close as it gets'}
                  </Text>
                </View>
                <Pressable
                  onPress={interactWithCreature}
                  disabled={selectedInteracted}
                  style={({ pressed }) => [
                    styles.dailyInteraction,
                    selectedInteracted && styles.dailyInteractionDone,
                    pressed && !selectedInteracted && styles.pressedOpacity,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={selectedInteracted ? 'Daily moment completed' : 'Spend a moment together'}
                >
                  <Ionicons name={selectedInteracted ? 'checkmark' : 'heart'} size={17} color="#171A17" />
                  <Text style={styles.dailyInteractionText}>
                    {selectedInteracted ? 'moment shared today' : 'spend a moment'}
                  </Text>
                </Pressable>
                <Text style={styles.bonusText}>
                  {selectedInteracted
                    ? `Trail focus today: ${trailFocus} · ${selectedBond.days} ${
                        selectedBond.days === 1 ? 'day' : 'days'
                      } together`
                    : 'Reward: +1 trail focus · +1 day together'}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.battleBtn, pressed && styles.pressedOpacity]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setPendingBattle(inspectedCreature)
                  setInspectedCreature(null)
                  router.push('/battle')
                }}
                accessibilityRole="button"
                accessibilityLabel="Fight with this companion"
              >
                <Text style={styles.battleBtnText}>fight</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={expeditionOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => setExpeditionOpen(false)}
      >
        <SafeAreaView style={styles.expeditionPage} edges={['top', 'bottom']}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Explore</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close expeditions"
              onPress={() => setExpeditionOpen(false)}
              hitSlop={10}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.expeditionContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>TODAY</Text>
            <View style={styles.missionSection}>
              <View style={styles.missionHeader}>
                <View style={styles.missionSymbol}>
                  <Ionicons name="compass" size={21} color="#171A17" />
                </View>
                <View style={styles.dailyCopy}>
                  <Text style={styles.dailyTitle}>{mission.title}</Text>
                  <Text style={styles.dailyPrompt}>{mission.prompt}</Text>
                </View>
                <Text style={styles.dailyCount}>
                  {mission.current}/{mission.target}
                </Text>
              </View>
              <View style={styles.sheetProgressTrack}>
                <View style={[styles.sheetProgressFill, { width: `${Math.round(missionProgress * 100)}%` }]} />
              </View>
              <Text style={styles.dailyReward}>
                {expeditionDone
                  ? `Earned ${mission.rewardXp} Explorer XP today`
                  : `Earn ${mission.rewardXp} Explorer XP`}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>CHOOSE A HABITAT</Text>
            <View style={styles.habitatList}>
              {HABITATS.map((habitat, index) => (
                <Pressable
                  key={habitat.key}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    setExpeditionOpen(false)
                    router.push('/camera')
                  }}
                  style={({ pressed }) => [styles.habitatRow, pressed && styles.rowPressed]}
                >
                  <View style={styles.habitatIcon}>
                    <Ionicons name={habitat.icon} size={20} color={theme.colors.text} />
                  </View>
                  <View style={[styles.habitatCopy, index < HABITATS.length - 1 && styles.rowSeparator]}>
                    <View style={styles.habitatTitleRow}>
                      <Text style={styles.habitatName}>{habitat.label}</Text>
                      {habitat.key === suggested ? <Text style={styles.suggestedText}>Suggested now</Text> : null}
                    </View>
                    <Text style={styles.habitatHint}>{habitat.hint}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={theme.colors.textFaint} />
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>THIS WEEK</Text>
            <View style={styles.weeklyRow}>
              <View style={styles.weeklyIcon}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.earth} />
              </View>
              <Text style={styles.weeklyPrompt}>{weeklyDiscoveryPrompt()}</Text>
            </View>

            <View style={styles.safetyNote}>
              <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.safetyText}>
                Keep your distance from wildlife and stay on public paths. Summon never shows exact animal locations.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <LevelUpBanner
        visible={levelUp !== null}
        progress={progress}
        unlocks={levelUp?.unlocks ?? []}
        onDismiss={() => setLevelUp(null)}
        reduceMotion={reduceMotion}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.viewfinder,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitatCompanionArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '52%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  decorationsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  decoration: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 20, 17, 0.58)',
  },
  decorationLeft: { left: 24, top: '58%' },
  decorationRight: { right: 28, top: '49%' },
  decorationCenter: { alignSelf: 'center', top: '67%' },
  arrivalBanner: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 35,
    minHeight: 40,
    maxWidth: '88%',
    paddingHorizontal: 16,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
  },
  arrivalText: { color: '#171A17', fontSize: 14, fontWeight: '700' },
  expeditionHud: { position: 'absolute', left: 16, right: 16, zIndex: 30 },
  expeditionCard: {
    borderRadius: 22,
    padding: 14,
    gap: 9,
    backgroundColor: 'rgba(15, 20, 17, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(183, 243, 74, 0.32)',
  },
  expeditionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expeditionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  expeditionCopy: { flex: 1 },
  expeditionEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: '#9CA69D' },
  expeditionTitle: { fontSize: 17, fontWeight: '900', color: '#F5F2E9' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(201, 166, 107, 0.16)',
  },
  streakText: { fontSize: 12, fontWeight: '900', color: '#F5F2E9' },
  hudDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: 'rgba(245,242,233,0.24)' },
  expeditionPrompt: { fontSize: 13, color: '#DDE1D9' },
  missionProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  missionTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 242, 233, 0.14)',
  },
  missionFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },
  missionFillDone: { backgroundColor: theme.colors.primaryStrong },
  missionCount: { fontSize: 11, fontWeight: '900', color: theme.colors.primary },
  missionCountDone: { fontSize: 11, fontWeight: '900', color: theme.colors.primaryStrong },
  levelChip: {
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(183, 243, 74, 0.16)',
  },
  levelChipText: { fontSize: 11, fontWeight: '900', color: theme.colors.primary, letterSpacing: 0.4 },
  xpFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245, 242, 233, 0.12)',
  },
  xpFooterLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1, color: '#9CA69D' },
  xpFooterTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 242, 233, 0.14)',
  },
  xpFooterFill: { height: '100%', borderRadius: 2, backgroundColor: theme.colors.earth },
  xpFooterValue: { fontSize: 9, fontWeight: '800', color: '#9CA69D', letterSpacing: 0.3 },
  expeditionPage: { flex: 1, backgroundColor: theme.colors.background },
  sheetHeader: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  doneText: { fontSize: 17, fontWeight: '600', color: theme.colors.primaryStrong },
  expeditionContent: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 32, gap: 10 },
  sectionLabel: {
    paddingTop: 12,
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: theme.colors.textMuted,
  },
  missionSection: {
    padding: 16,
    gap: 12,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  missionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  missionSymbol: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  dailyCopy: { flex: 1, gap: 2 },
  dailyTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  dailyPrompt: { fontSize: 13, lineHeight: 18, color: theme.colors.textMuted },
  dailyReward: { fontSize: 12, color: theme.colors.textMuted },
  dailyCount: {
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  sheetProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceRaised,
  },
  sheetProgressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },
  habitatList: {
    overflow: 'hidden',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  habitatRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, gap: 12 },
  rowPressed: { backgroundColor: theme.colors.surfaceRaised },
  habitatIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.questSurfaceRaised,
  },
  habitatCopy: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', gap: 2 },
  rowSeparator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  habitatTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  habitatName: { fontSize: 16, fontWeight: '500', color: theme.colors.text },
  habitatHint: { fontSize: 13, color: theme.colors.textMuted },
  suggestedText: { fontSize: 12, fontWeight: '500', color: theme.colors.primaryStrong },
  weeklyRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  weeklyIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.questSurfaceRaised,
  },
  weeklyPrompt: { flex: 1, fontSize: 15, lineHeight: 20, color: theme.colors.text },
  safetyNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 12, paddingTop: 8 },
  safetyText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  draggableFrame: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionAvatarPhoto: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: '#B7F34A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  companionCutoutImg: {
    width: 80,
    height: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  companionMascotImg: {
    width: 76,
    height: 76,
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  scanCircleBtn: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  scanLensImg: {
    width: 72,
    height: 72,
  },
  playerAvatar: {
    position: 'absolute',
    alignSelf: 'center',
    width: 100,
    height: 150,
    zIndex: 12,
  },
  scanBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inspectModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#182019',
    borderRadius: 32,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(183, 243, 74, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  inspectHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  inspectTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#B7F34A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lifePanel: {
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 8,
    gap: 10,
  },
  lifeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lifeStatusRight: { alignItems: 'flex-end' },
  lifeLabel: { color: '#9CA69D', fontSize: 10, fontWeight: '700' },
  lifeValue: { marginTop: 2, color: '#F5F2E9', fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  lifeMessage: { color: '#C3C9C4', fontSize: 13, lineHeight: 18 },
  bondRow: { gap: 6 },
  bondTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 242, 233, 0.16)',
  },
  bondFill: { height: '100%', borderRadius: 2, backgroundColor: '#C9A66B' },
  bondHint: { color: '#9CA69D', fontSize: 11 },
  dailyInteraction: {
    minHeight: 44,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
  },
  dailyInteractionDone: { opacity: 0.5 },
  dailyInteractionText: { color: '#171A17', fontSize: 14, fontWeight: '700' },
  bonusText: { color: '#9CA69D', fontSize: 11, textAlign: 'center' },
  battleBtn: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#B7F34A',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 20,
  },
  battleBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#171A17',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F1411',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 242, 233, 0.12)',
  },
  pressedOpacity: {
    opacity: 0.75,
  },
})
