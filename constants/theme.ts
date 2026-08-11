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
    background: adaptiveColor('#0B1120', '#0F172A'),
    surface: adaptiveColor('#1E293B', '#1E293B'),
    surfaceRaised: adaptiveColor('#334155', '#334155'),
    glassSurface: adaptiveColor('rgba(30, 41, 59, 0.75)', 'rgba(30, 41, 59, 0.85)'),
    glassSurfaceStrong: adaptiveColor('rgba(30, 41, 59, 0.92)', 'rgba(15, 23, 42, 0.95)'),
    glassBorder: adaptiveColor('rgba(56, 189, 248, 0.20)', 'rgba(56, 189, 248, 0.25)'),
    specimenSurface: adaptiveColor('#334155', '#1E293B'),
    border: adaptiveColor('rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.15)'),
    rule: adaptiveColor('rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.10)'),
    text: adaptiveColor('#F8FAFC', '#F8FAFC'),
    textMuted: adaptiveColor('#94A3B8', '#94A3B8'),
    textFaint: adaptiveColor('#64748B', '#64748B'),
    primary: adaptiveColor('#38BDF8', '#38BDF8'),
    primaryStrong: adaptiveColor('#0284C7', '#0284C7'),
    discoverySurface: adaptiveColor('#1E293B', '#0F172A'),
    discoveryAccent: adaptiveColor('#F59E0B', '#F59E0B'),
    speciesSurface: adaptiveColor('#1E293B', '#0F172A'),
    speciesAccent: adaptiveColor('#38BDF8', '#38BDF8'),
    questSurface: adaptiveColor('#F59E0B', '#F59E0B'),
    questSurfaceRaised: adaptiveColor('rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.20)'),
    questText: adaptiveColor('#FEF3C7', '#FEF3C7'),
    questMuted: adaptiveColor('#FCD34D', '#FCD34D'),
    viewfinder: '#000000',
    onDark: '#F8FAFC',
    onPrimary: '#0F172A',
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
