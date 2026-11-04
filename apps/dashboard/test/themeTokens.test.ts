// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { darkColors, lightColors, MINIMUM_TOUCH_TARGET, spacing, type ColorTokens } from '../../mobile/src/theme/tokens.ts';

const tokensCss = readFileSync(new URL('../src/theme/tokens.css', import.meta.url), 'utf8');
const [lightBlock = '', darkBlock = ''] = tokensCss.split('@media (prefers-color-scheme: dark)');

function kebabCase(token: string): string {
  return token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function cssName(token: string): string {
  return `--${kebabCase(token)}`;
}

function cssColors(block: string): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const [, name = '', value = ''] of block.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    colors[name] = value.toUpperCase();
  }
  return colors;
}

function cssPixels(block: string): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const [, name = '', value = ''] of block.matchAll(/(--[a-z-]+):\s*(\d+)px;/g)) {
    sizes[name] = Number(value);
  }
  return sizes;
}

function expectedPixels(): Record<string, number> {
  const spaces = Object.entries(spacing).map(([token, value]) => [`--space-${kebabCase(token)}`, value]);
  return { ...Object.fromEntries(spaces), '--touch-target': MINIMUM_TOUCH_TARGET };
}

function expectedColors(tokens: ColorTokens): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).map(([token, value]) => [cssName(token), value.toUpperCase()]));
}

describe('dashboard theme tokens', () => {
  it('uses the mobile light colours', () => {
    expect(cssColors(lightBlock)).toEqual(expectedColors(lightColors));
  });

  it('uses the mobile dark colours', () => {
    expect(cssColors(darkBlock)).toEqual(expectedColors(darkColors));
  });

  it('uses the mobile spacing and touch target', () => {
    expect(cssPixels(lightBlock)).toEqual(expectedPixels());
  });
});
