export interface ColorTokens {
  readonly canvas: string;
  readonly sunken: string;
  readonly ink: string;
  readonly muted: string;
  readonly line: string;
  readonly free: string;
  readonly danger: string;
  readonly onInk: string;
}

export const lightColors: ColorTokens = {
  canvas: '#F8F9F6',
  sunken: '#E4E6E0',
  ink: '#191C1A',
  muted: '#4B534D',
  line: '#D2D6CE',
  free: '#2E7D4F',
  danger: '#9C3A2A',
  onInk: '#F8F9F6',
};

export const darkColors: ColorTokens = {
  canvas: '#121513',
  sunken: '#242925',
  ink: '#E7EAE4',
  muted: '#AEB6AE',
  line: '#2C322D',
  free: '#63B487',
  danger: '#D9705E',
  onInk: '#121513',
};

export const fontFamilies = {
  text: 'Archivo_400Regular',
  textSemiBold: 'Archivo_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

export const spacing = {
  extraSmall: 4,
  small: 8,
  medium: 16,
  large: 24,
  extraLarge: 40,
} as const;

export const MINIMUM_TOUCH_TARGET = 44;
