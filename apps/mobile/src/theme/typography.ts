import { StyleSheet } from 'react-native';
import { fontFamilies } from './tokens';

export const typography = StyleSheet.create({
  eyebrow: { fontFamily: fontFamilies.mono, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase' },
  title: { fontFamily: fontFamilies.textSemiBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  lotName: { fontFamily: fontFamilies.textSemiBold, fontSize: 18, lineHeight: 23 },
  countNumber: { fontFamily: fontFamilies.monoSemiBold, fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums'] },
  countState: { fontFamily: fontFamilies.textSemiBold, fontSize: 22, lineHeight: 28 },
  // No line height: the line holding the larger spot number grows on its own, the next lines stay tight.
  spotLine: { fontFamily: fontFamilies.textSemiBold, fontSize: 22 },
  spotNumber: { fontFamily: fontFamilies.monoSemiBold, fontSize: 36, fontVariant: ['tabular-nums'] },
  // A figure inside a sentence of body text: same size, mono with tabular digits.
  figure: { fontFamily: fontFamilies.mono, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  countLabel: { fontFamily: fontFamilies.mono, fontSize: 14, lineHeight: 18 },
  body: { fontFamily: fontFamilies.text, fontSize: 16 },
  bodyStrong: { fontFamily: fontFamilies.textSemiBold, fontSize: 17 },
  textButton: { fontFamily: fontFamilies.textSemiBold, fontSize: 16, lineHeight: 20, textDecorationLine: 'underline' },
  button: { fontFamily: fontFamilies.textSemiBold, fontSize: 16 },
});
