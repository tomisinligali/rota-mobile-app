/**
 * Design system tokens derived from design-tokens.tokens.json & design-system-rule.md
 * Using semantic color roles and exact typographic hierarchy.
 */

export const colors = {
  // Primary
  primary: '#6600CC',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E4D3F8',
  onPrimaryContainer: '#481584',

  // Secondary
  secondary: '#5A20AC',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E3D4F7',
  onSecondaryContainer: '#441881',

  // Neutral / Surface
  surface: '#F9F8FA',
  onSurface: '#1C1A1F',
  surfaceVariant: '#E4E2E6',
  onSurfaceVariant: '#48454E',
  surfaceContainer: '#F1EFF3',
  surfaceContainerLow: '#F9F8FA',
  surfaceContainerHigh: '#E4E2E6',
  surfaceContainerHighest: '#DCD9DF',

  // Semantic Status Roles
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',

  success: '#06C647',
  onSuccess: '#FFFFFF',
  successContainer: '#CEFDDE',
  onSuccessContainer: '#059435',

  warning: '#BA7B0D',
  onWarning: '#FFFFFF',
  warningContainer: '#FFDF9E',
  onWarningContainer: '#664100',

  info: '#1B65DE',
  onInfo: '#FFFFFF',
  infoContainer: '#D8E2FF',
  onInfoContainer: '#001A41',

  border: '#CAC4D0',
};

export const typography = {
  displayLarge: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
  displayMedium: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.25 },
  headlineLarge: { fontSize: 30, fontWeight: '600' as const, letterSpacing: 0 },
  headlineMedium: { fontSize: 26, fontWeight: '600' as const, letterSpacing: 0 },
  headlineSmall: { fontSize: 22, fontWeight: '600' as const, letterSpacing: 0 },
  titleLarge: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.15 },
  titleMedium: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, fontWeight: '600' as const, letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, fontWeight: '600' as const, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  full: 9999,
};
