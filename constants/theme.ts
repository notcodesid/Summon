/**
 * Field-guide editorial: warm paper ground, near-black ink, rarity as the only
 * hue. Structure comes from hairline rules and spacing rather than boxes.
 */
export const theme = {
  colors: {
    background: '#FCFCFB',
    surface: '#F4F4F2',
    surfaceRaised: '#ECECE9',
    border: '#E5E5E1',
    /** Hairline rules between rows — lighter than a border. */
    rule: '#EAEAE6',
    text: '#111210',
    textMuted: '#767773',
    /** Micro-labels and captions; one step quieter than textMuted. */
    textFaint: '#9B9C97',
    primary: '#111210',
    primaryStrong: '#000000',
    /** Camera viewfinder only — deliberate true black behind a live preview. */
    viewfinder: '#000000',
    onDark: '#FCFCFB',
  },

  /** Radius varies by role on purpose: pills for actions, softer for specimens. */
  radius: { tile: 14, button: 20, card: 26, pill: 999 },

  /** 4pt rhythm. */
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    section: 48,
  },

  type: {
    /** Wordmark and creature names. */
    display: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
    title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
    body: { fontSize: 15, fontWeight: '400', letterSpacing: 0 },
    /** Specimen tags: uppercase, tracked out. */
    micro: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
    /** Big counts in the index. */
    numeral: { fontSize: 44, fontWeight: '800', letterSpacing: -1.5 },
  },

  font: { display: 'Arial Rounded MT Bold', body: 'System' },
} as const
