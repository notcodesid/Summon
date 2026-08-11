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
/**
 * Summon Brand Design System Palette
 * 70% real world / 20% game / 10% magic
 * Discovery signal green: #B7F34A
 */
export const theme = {
  colors: {
    background: adaptiveColor('#F5F2E9', '#0F1411'),
    surface: adaptiveColor('#FFFFFF', '#182019'),
    surfaceRaised: adaptiveColor('#DDE1D9', '#222C23'),
    glassSurface: adaptiveColor('rgba(255, 255, 255, 0.85)', 'rgba(24, 32, 25, 0.88)'),
    glassSurfaceStrong: adaptiveColor('rgba(245, 242, 233, 0.95)', 'rgba(15, 20, 17, 0.95)'),
    glassBorder: adaptiveColor('rgba(183, 243, 74, 0.30)', 'rgba(183, 243, 74, 0.35)'),
    specimenSurface: adaptiveColor('#F5F2E9', '#182019'),
    border: adaptiveColor('rgba(23, 26, 23, 0.12)', 'rgba(245, 242, 233, 0.12)'),
    rule: adaptiveColor('rgba(23, 26, 23, 0.08)', 'rgba(245, 242, 233, 0.08)'),
    text: adaptiveColor('#171A17', '#F5F2E9'),
    textMuted: adaptiveColor('#68736A', '#9CA69D'),
    textFaint: adaptiveColor('#9CA69D', '#68736A'),
    primary: '#B7F34A',
    primaryStrong: '#9EE02E',
    discoverySurface: adaptiveColor('#FFFFFF', '#182019'),
    discoveryAccent: '#B7F34A',
    speciesSurface: adaptiveColor('#FFFFFF', '#182019'),
    speciesAccent: '#B7F34A',
    earth: '#C9A66B',
    questSurface: '#C9A66B',
    questSurfaceRaised: 'rgba(201, 166, 107, 0.20)',
    questText: '#F5F2E9',
    questMuted: '#C9A66B',
    viewfinder: '#0F1411',
    onDark: '#F5F2E9',
    onPrimary: '#171A17',
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
