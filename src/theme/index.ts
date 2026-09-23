import { Platform } from 'react-native';

/**
 * Design-Tokens. Standardfarben aus dem Logo des Ev. Schulzentrums Radebeul.
 * Die Primärfarbe kann pro Schule über `GET /api/v1/instance` überschrieben werden
 * (siehe useBrand()).
 */
export const palette = {
  navy: '#253364',
  navyDark: '#1A2548',
  navyLight: '#E8EBF4',
  red: '#9D1D34',
  redLight: '#F7E6E9',
  white: '#FFFFFF',
  gray50: '#F7F8FA',
  gray100: '#EEF0F4',
  gray200: '#DDE1E8',
  gray400: '#9AA2B1',
  gray600: '#5B6475',
  gray900: '#1B2130',
  green: '#1F7A4D',
  greenLight: '#E4F3EB',
  amber: '#B26A00',
  amberLight: '#FFF3E0',
} as const;

export const colors = {
  primary: palette.navy,
  primaryPressed: palette.navyDark,
  primarySoft: palette.navyLight,
  accent: palette.red,
  accentSoft: palette.redLight,
  background: palette.gray50,
  surface: palette.white,
  border: palette.gray200,
  divider: palette.gray100,
  text: palette.gray900,
  textMuted: palette.gray600,
  textSubtle: palette.gray400,
  onPrimary: palette.white,
  success: palette.green,
  successSoft: palette.greenLight,
  warning: palette.amber,
  warningSoft: palette.amberLight,
  danger: palette.red,
  dangerSoft: palette.redLight,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const font = {
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

/** Mindestgröße für Tippflächen (Apple HIG 44pt, Material 48dp). */
export const touchTarget = 48;

/** Ab dieser Breite gilt das Tablet-Layout (iPad hochkant = 768). */
export const tabletBreakpoint = 700;

export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: {},
});
