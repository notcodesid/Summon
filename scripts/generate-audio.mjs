#!/usr/bin/env node
/**
 * Generates Summon's sound palette as 16-bit mono WAV files.
 *
 * These are synthesised rather than sampled, so there is no licence to track
 * and no binary blob to review — re-running this script reproduces exactly the
 * same files. Replace any of them with designed audio later; the app only
 * depends on the file names in assets/audio/.
 *
 *   npm run audio:generate
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', 'assets', 'audio')

/**
 * 22.05 kHz. Everything here sits below 11 kHz — the highest partial is a
 * bell ratio of 3.01 on the top note of the legendary arpeggio, around 4.7 kHz
 * — so the extra octave at 44.1 kHz would only buy file size.
 */
const SAMPLE_RATE = 22050
const PEAK = 0.82

// --- synthesis primitives -------------------------------------------------

/** Exponential decay envelope with a short attack, so nothing clicks. */
function envelope(t, duration, { attack = 0.004, curve = 6, sustain = 0 } = {}) {
  if (t < attack) return t / attack
  const decayed = Math.exp((-curve * (t - attack)) / Math.max(0.001, duration - attack))
  return sustain + (1 - sustain) * decayed
}

/**
 * A struck-bell voice: a carrier phase-modulated by a decaying partial.
 * The modulation index falling faster than the amplitude is what makes it read
 * as metal rather than as a buzzer.
 */
function bell(t, freq, duration, { index = 2.4, ratio = 3.01, curve = 5 } = {}) {
  const env = envelope(t, duration, { curve })
  const modEnv = Math.exp((-8 * t) / Math.max(0.001, duration))
  return Math.sin(2 * Math.PI * freq * t + index * modEnv * Math.sin(2 * Math.PI * freq * ratio * t)) * env
}

/** A soft flute-ish tone — sine with a gentle attack, no modulation. */
function tone(t, freq, duration, { attack = 0.012, curve = 4 } = {}) {
  return Math.sin(2 * Math.PI * freq * t) * envelope(t, duration, { attack, curve })
}

/** A pitch sweep, for whooshes and impacts. */
function sweep(t, from, to, duration, { curve = 3 } = {}) {
  const k = (to / from) ** (1 / Math.max(0.001, duration))
  const phase = (2 * Math.PI * from * (k ** t - 1)) / Math.log(k)
  return Math.sin(phase) * envelope(t, duration, { attack: 0.002, curve })
}

/** Deterministic noise — a fixed seed keeps regenerated files byte-identical. */
function makeNoise(seed = 1) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return (state / 0xffffffff) * 2 - 1
  }
}

function noiseBurst(t, duration, { curve = 22, seed = 7 } = {}) {
  const noise = makeNoise(seed)
  const env = Math.exp((-curve * t) / Math.max(0.001, duration))
  return noise() * env
}

// --- note helpers ---------------------------------------------------------

/** Equal temperament from A4, so the arpeggios are actually in tune. */
function note(semitonesFromA4) {
  return 440 * 2 ** (semitonesFromA4 / 12)
}

const C5 = -9
const MAJOR = [0, 4, 7, 12]

// --- voices ---------------------------------------------------------------

function render(duration, fn) {
  const length = Math.ceil(duration * SAMPLE_RATE)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i += 1) out[i] = fn(i / SAMPLE_RATE, i)
  return out
}

/** Layered voices: each returns a sample function, summed then normalised. */
function mix(...layers) {
  return (t, i) => layers.reduce((sum, fn) => sum + fn(t, i), 0)
}

function sequence(notes, { gain = 0.9, overlap = 0.55 } = {}) {
  return (t) => {
    let value = 0
    for (const { at, freq, dur, voice = bell, options } of notes) {
      const local = t - at
      if (local < 0 || local > dur * overlap) continue
      value += gain * voice(local, freq, dur, options)
    }
    return value
  }
}

// --- the palette ----------------------------------------------------------

const sounds = {
  /** The viewfinder finding its subject. Short, bright, two steps up. */
  'lock-on': {
    duration: 0.2,
    render: sequence([
      { at: 0, freq: note(C5 + 12), dur: 0.07, voice: tone, options: { curve: 9 } },
      { at: 0.055, freq: note(C5 + 19), dur: 0.11, voice: tone, options: { curve: 7 } },
    ]),
  },

  /** Shutter: a sharp noise transient over a low click. */
  shutter: {
    duration: 0.12,
    render: mix(
      (t) => noiseBurst(t, 0.12, { curve: 34, seed: 21 }) * 0.8,
      (t) => sweep(t, 320, 120, 0.09, { curve: 16 }) * 0.5,
    ),
  },

  /** A landed hit: the pitch drops away from you. */
  hit: {
    duration: 0.24,
    render: mix(
      (t) => sweep(t, 150, 52, 0.24, { curve: 7 }) * 0.9,
      (t) => noiseBurst(t, 0.09, { curve: 30, seed: 33 }) * 0.45,
    ),
  },

  /** Bracing: muffled, no transient, so it reads as absorbing rather than dealing. */
  guard: {
    duration: 0.26,
    render: mix(
      (t) => tone(t, note(C5 - 12), 0.26, { attack: 0.02, curve: 6 }) * 0.8,
      (t) => tone(t, note(C5 - 5), 0.2, { attack: 0.03, curve: 8 }) * 0.35,
    ),
  },

  /** An instinct move: brighter and wider than a plain strike. */
  instinct: {
    duration: 0.55,
    render: mix(
      (t) => sweep(t, 380, 1250, 0.5, { curve: 2.6 }) * 0.7,
      (t) => sequence([{ at: 0.16, freq: note(C5 + 7), dur: 0.36, options: { curve: 4 } }])(t) * 0.5,
    ),
  },

  /** Levelling up: a rising triad, each note ringing into the next. */
  'level-up': {
    duration: 1.3,
    render: sequence(
      [0, 4, 7, 12].map((step, index) => ({
        at: index * 0.1,
        freq: note(C5 + step),
        dur: 1.0,
        options: { index: 2.2, curve: 3.4 },
      })),
      { gain: 0.7, overlap: 0.95 },
    ),
  },

  /** The expedition closing out — warm, two notes, understated. */
  expedition: {
    duration: 0.85,
    render: sequence(
      [
        { at: 0, freq: note(C5), dur: 0.6, options: { curve: 4 } },
        { at: 0.13, freq: note(C5 + 7), dur: 0.7, options: { curve: 3.6 } },
      ],
      { gain: 0.8, overlap: 0.9 },
    ),
  },

  victory: {
    duration: 1.2,
    render: sequence(
      MAJOR.map((step, index) => ({ at: index * 0.1, freq: note(C5 + step), dur: 0.95, options: { curve: 3.2 } })),
      { gain: 0.72, overlap: 0.95 },
    ),
  },

  defeat: {
    duration: 1.0,
    render: sequence(
      [
        { at: 0, freq: note(C5), dur: 0.6, options: { curve: 4 } },
        { at: 0.18, freq: note(C5 - 3), dur: 0.8, options: { curve: 3.2 } },
      ],
      { gain: 0.75, overlap: 0.95 },
    ),
  },
}

/**
 * A discovery sting per rarity. The tier decides how many notes the arpeggio
 * has and how bright it rings, so a legendary is unmistakable from a common
 * before you have read a single word on the card.
 */
const REVEAL_TIERS = [
  { name: 'common', notes: 2, steps: [0, 7], index: 1.4, curve: 5 },
  { name: 'uncommon', notes: 3, steps: [0, 4, 7], index: 1.7, curve: 4.6 },
  { name: 'rare', notes: 4, steps: [0, 4, 7, 12], index: 2.1, curve: 4.2 },
  { name: 'epic', notes: 5, steps: [0, 4, 7, 12, 16], index: 2.5, curve: 3.8 },
  { name: 'legendary', notes: 6, steps: [0, 4, 7, 12, 16, 19], index: 3, curve: 3.4 },
]

for (const tier of REVEAL_TIERS) {
  const arpeggio = sequence(
    tier.steps.map((step, index) => ({
      at: index * 0.085,
      freq: note(C5 + step),
      dur: 0.8 + index * 0.05,
      options: { index: tier.index, curve: tier.curve },
    })),
    { gain: 0.62, overlap: 0.95 },
  )

  // The richer tiers carry a quiet shimmer above the arpeggio, so the top of
  // the scale sounds like it has air around it.
  const shimmer =
    tier.notes >= 4
      ? sequence([{ at: 0.3, freq: note(C5 + 24), dur: 0.55, voice: tone, options: { attack: 0.03, curve: 6 } }], {
          gain: 0.18,
          overlap: 0.95,
        })
      : null

  sounds[`reveal-${tier.name}`] = {
    duration: tier.notes * 0.09 + 0.9,
    render: shimmer ? mix(arpeggio, shimmer) : arpeggio,
  }
}

// --- WAV encoding ---------------------------------------------------------

function toPcm16(samples) {
  let peak = 0
  for (const value of samples) peak = Math.max(peak, Math.abs(value))
  const scale = peak > 0 ? PEAK / peak : 0

  const buffer = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] * scale))
    buffer.writeInt16LE(Math.round(clamped * 32767), i * 2)
  }
  return buffer
}

function wavFile(pcm) {
  const header = Buffer.alloc(44)
  const byteRate = SAMPLE_RATE * 2

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // PCM chunk size
  header.writeUInt16LE(1, 20) // format: PCM
  header.writeUInt16LE(1, 22) // channels: mono
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(2, 32) // block align
  header.writeUInt16LE(16, 34) // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)

  return Buffer.concat([header, pcm])
}

// --- write ----------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })

let total = 0
for (const [name, spec] of Object.entries(sounds)) {
  const samples = render(spec.duration, spec.render)
  const file = wavFile(toPcm16(samples))
  writeFileSync(join(OUT_DIR, `${name}.wav`), file)
  total += file.length
  console.log(`  ${name.padEnd(20)} ${(file.length / 1024).toFixed(1)} KB`)
}

console.log(`\n${Object.keys(sounds).length} sounds, ${(total / 1024).toFixed(0)} KB total → assets/audio/`)
