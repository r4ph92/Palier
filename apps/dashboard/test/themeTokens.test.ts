// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { darkColors, lightColors, type ColorTokens } from '../../mobile/src/theme/tokens.ts';

const tokensCss = readFileSync(new URL('../src/theme/tokens.css', import.meta.url), 'utf8');
const [lightBlock = '', darkBlock = ''] = tokensCss.split('@media (prefers-color-scheme: dark)');

function cssName(token: string): string {
  return `--${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function cssColors(block: string): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const [, name = '', value = ''] of block.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    colors[name] = value.toUpperCase();
  }
  return colors;
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
});
