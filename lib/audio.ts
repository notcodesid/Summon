import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { revealSoundFor } from '@/lib/feedback-cues'

export { revealSoundFor } from '@/lib/feedback-cues'

/**
 * Summon's sound palette.
 *
 * The files are synthesised by scripts/generate-audio.mjs rather than sampled,
 * so there is nothing to license and nothing opaque in the repository. Swap any
 * of them for designed audio later — only the names below matter to the app.
 *
 * Every call here is defensive. A missing or slow sound must never take a
 * screen down, so failures are logged and swallowed rather than thrown.
 */

const SOURCES = {
  'lock-on': require('../assets/audio/lock-on.wav'),
  shutter: require('../assets/audio/shutter.wav'),
  hit: require('../assets/audio/hit.wav'),
  guard: require('../assets/audio/guard.wav'),
  instinct: require('../assets/audio/instinct.wav'),
  'level-up': require('../assets/audio/level-up.wav'),
  expedition: require('../assets/audio/expedition.wav'),
  victory: require('../assets/audio/victory.wav'),
  defeat: require('../assets/audio/defeat.wav'),
  'reveal-common': require('../assets/audio/reveal-common.wav'),
  'reveal-uncommon': require('../assets/audio/reveal-uncommon.wav'),
  'reveal-rare': require('../assets/audio/reveal-rare.wav'),
  'reveal-epic': require('../assets/audio/reveal-epic.wav'),
  'reveal-legendary': require('../assets/audio/reveal-legendary.wav'),
} as const

export type SoundName = keyof typeof SOURCES

/** Not every sound deserves equal weight. */
const MIX: Record<SoundName, number> = {
  'lock-on': 0.45,
  shutter: 0.5,
  hit: 0.7,
  guard: 0.55,
  instinct: 0.65,
  'level-up': 0.85,
  expedition: 0.65,
  victory: 0.8,
  defeat: 0.65,
  'reveal-common': 0.55,
  'reveal-uncommon': 0.6,
  'reveal-rare': 0.68,
  'reveal-epic': 0.75,
  'reveal-legendary': 0.88,
}

const MUTE_KEY = 'summon.audio.muted.v1'

let muted = false
let configured = false
const players = new Map<SoundName, AudioPlayer>()

/**
 * Effects are played even when the ringer switch is off. Summon has no music,
 * only short one-shot feedback, so a silent switch would otherwise make the app
 * look like it had no sound at all. Flip `playsInSilentMode` to false to defer
 * to the switch.
 */
export async function initAudio(): Promise<void> {
  if (configured) return
  configured = true
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false })
  } catch (error) {
    console.warn('audio: could not configure the audio session', error)
  }
}

export async function loadMutePreference(): Promise<boolean> {
  try {
    muted = (await AsyncStorage.getItem(MUTE_KEY)) === '1'
  } catch {
    muted = false
  }
  return muted
}

export async function setMuted(next: boolean): Promise<void> {
  muted = next
  try {
    await AsyncStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    // The preference is a convenience; losing it costs one tap.
  }
}

export function isMuted(): boolean {
  return muted
}

function playerFor(name: SoundName): AudioPlayer | null {
  const existing = players.get(name)
  if (existing) return existing

  try {
    const player = createAudioPlayer(SOURCES[name])
    player.volume = MIX[name]
    players.set(name, player)
    return player
  } catch (error) {
    console.warn(`audio: could not prepare "${name}"`, error)
    return null
  }
}

/**
 * Warms the players for sounds that must land the instant they are asked for —
 * a lock-on blip that arrives late is worse than no blip at all.
 */
export function preloadAudio(names: SoundName[]): void {
  if (muted) return
  for (const name of names) playerFor(name)
}

export function playSound(name: SoundName): void {
  if (muted) return
  const player = playerFor(name)
  if (!player) return

  try {
    // Effects are retriggered faster than they finish, so every call restarts
    // from the top instead of being swallowed by the tail of the last one.
    void Promise.resolve(player.seekTo(0)).then(
      () => player.play(),
      () => player.play(),
    )
  } catch (error) {
    console.warn(`audio: could not play "${name}"`, error)
  }
}
