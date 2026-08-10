import { DynamicColorIOS, Platform } from 'react-native'

function adaptiveColor(light: string, dark: string): string {
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({ light, dark }) as unknown as string
  }

  return light
}

/**
 * Playful field journal: warm paper, botanical green, and a few semantic
 * discovery colors. Colors follow the system appearance; users do not choose
 * an app theme.
 */
export const theme = {
  colors: {
    background: adaptiveColor('#F7F5EA', '#101510'),
    surface: adaptiveColor('#FFFDF7', '#1A211B'),
    surfaceRaised: adaptiveColor('#EEEDE3', '#263027'),
    glassSurface: adaptiveColor('rgba(255, 253, 247, 0.68)', 'rgba(34, 45, 36, 0.68)'),
    glassSurfaceStrong: adaptiveColor('rgba(255, 253, 247, 0.84)', 'rgba(42, 55, 44, 0.82)'),
    glassBorder: adaptiveColor('rgba(47, 125, 91, 0.10)', 'rgba(221, 241, 226, 0.12)'),
    specimenSurface: adaptiveColor('#E2E8DF', '#39453B'),
    border: adaptiveColor('#E3E1D5', '#334035'),
    /** Hairline rules between rows — lighter than a border. */
    rule: adaptiveColor('#EAEAE6', '#272923'),
    text: adaptiveColor('#18221C', '#F4F7F0'),
    textMuted: adaptiveColor('#687169', '#B6C0B6'),
    /** Micro-labels and captions; one step quieter than textMuted. */
    textFaint: adaptiveColor('#9B9C97', '#85877E'),
    primary: adaptiveColor('#2F7D5B', '#69C592'),
    primaryStrong: adaptiveColor('#205A43', '#82D6A6'),
    discoverySurface: adaptiveColor('#DDEFF8', '#193442'),
    discoveryAccent: adaptiveColor('#2B6F93', '#78C4EB'),
    speciesSurface: adaptiveColor('#DDF1E2', '#1D3927'),
    speciesAccent: adaptiveColor('#2F7D5B', '#69C592'),
    questSurface: adaptiveColor('#FFE6A7', '#463713'),
    questSurfaceRaised: adaptiveColor('rgba(255, 253, 247, 0.72)', 'rgba(255, 230, 167, 0.10)'),
    questText: adaptiveColor('#4A3710', '#FFE8AF'),
    questMuted: adaptiveColor('#715B27', '#D8BF80'),
    /** Camera viewfinder only — deliberate true black behind a live preview. */
    viewfinder: '#000000',
    onDark: '#FCFCFB',
    onPrimary: '#FFFFFF',
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
