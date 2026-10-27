import { StyleSheet } from 'react-native';
import { fontFamilies } from './tokens';

export const typography = StyleSheet.create({
  eyebrow: { fontFamily: fontFamilies.mono, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase' },
  title: { fontFamily: fontFamilies.textSemiBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  lotName: { fontFamily: fontFamilies.textSemiBold, fontSize: 19, lineHeight: 24 },
  count: { fontFamily: fontFamilies.mono, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  body: { fontFamily: fontFamilies.text, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamilies.textSemiBold, fontSize: 17, lineHeight: 22 },
  button: { fontFamily: fontFamilies.textSemiBold, fontSize: 16, lineHeight: 20 },
});
