import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
});

export const typography = {
  display: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
    letterSpacing: 0.37,
    fontFamily,
  },
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, fontFamily },
  h2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28, fontFamily },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 25, fontFamily },
  h4: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22, fontFamily },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22, fontFamily },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 22, fontFamily },
  bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, fontFamily },
  bodySmMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, fontFamily },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, fontFamily },
  captionMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16, fontFamily },
  buttonLg: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22, fontFamily },
  buttonMd: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20, fontFamily },
  buttonSm: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18, fontFamily },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, fontFamily },
  button: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20, fontFamily },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
    letterSpacing: 0.5,
    fontFamily,
  },
};
