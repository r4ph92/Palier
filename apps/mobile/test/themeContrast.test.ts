import { darkColors, lightColors, type ColorTokens } from '../src/theme/tokens';

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => channel(parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

describe.each<[string, ColorTokens]>([
  ['light', lightColors],
  ['dark', darkColors],
])('theme tokens in %s mode', (_mode, colors) => {
  it('keeps the text on the signage yellow readable', () => {
    expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('sets the yellow apart from the screen by its border, or by itself on a dark screen', () => {
    const borderOrFill = Math.max(contrast(colors.onAccent, colors.canvas), contrast(colors.accent, colors.canvas));
    expect(borderOrFill).toBeGreaterThanOrEqual(3);
  });

  it('keeps both gauge fills visible on the gauge track', () => {
    expect(contrast(colors.free, colors.sunken)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.low, colors.sunken)).toBeGreaterThanOrEqual(3);
  });
});
