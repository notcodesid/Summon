import { DynamicColorIOS, Platform } from 'react-native'

function adaptiveColor(light: string, dark: string): string {
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({ light, dark }) as unknown as string
  }

  return light
}

/**
 * Field-guide editorial: warm paper ground, near-black ink, rarity as the only
 * hue. Colors follow the system appearance; users do not choose an app theme.
 */
export const theme = {
  colors: {
    background: adaptiveColor('#FCFCFB', '#10110F'),
    surface: adaptiveColor('#F4F4F2', '#1A1B18'),
    surfaceRaised: adaptiveColor('#ECECE9', '#23241F'),
    glassSurface: adaptiveColor('rgba(17, 18, 16, 0.08)', 'rgba(245, 245, 239, 0.11)'),
    glassSurfaceStrong: adaptiveColor('rgba(17, 18, 16, 0.12)', 'rgba(245, 245, 239, 0.16)'),
    glassBorder: adaptiveColor('rgba(17, 18, 16, 0.10)', 'rgba(245, 245, 239, 0.12)'),
    specimenSurface: adaptiveColor('#E2E3DE', '#3B3D36'),
    border: adaptiveColor('#E5E5E1', '#32342E'),
    /** Hairline rules between rows — lighter than a border. */
    rule: adaptiveColor('#EAEAE6', '#272923'),
    text: adaptiveColor('#111210', '#F5F5EF'),
    textMuted: adaptiveColor('#767773', '#B5B6AD'),
    /** Micro-labels and captions; one step quieter than textMuted. */
    textFaint: adaptiveColor('#9B9C97', '#85877E'),
    primary: adaptiveColor('#111210', '#F5F5EF'),
    primaryStrong: adaptiveColor('#000000', '#FFFFFF'),
    /** Camera viewfinder only — deliberate true black behind a live preview. */
    viewfinder: '#000000',
    onDark: '#FCFCFB',
    onPrimary: adaptiveColor('#FCFCFB', '#10110F'),
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
