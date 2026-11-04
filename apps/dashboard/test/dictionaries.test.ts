import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.ts';
import { fr } from '../src/i18n/fr.ts';
import { testSignInText } from '../src/testSignIn/testSignInText.ts';
import { leafStrings } from './frenchStrings.ts';

function keyPaths(dictionary: object, prefix = ''): string[] {
  return Object.entries(dictionary).flatMap(([key, value]: [string, unknown]) =>
    typeof value === 'object' && value !== null ? keyPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('dashboard dictionaries', () => {
  it('has the same keys in French and English', () => {
    expect(keyPaths(en)).toEqual(keyPaths(fr));
    expect(keyPaths(testSignInText.en)).toEqual(keyPaths(testSignInText.fr));
  });

  it('has no empty string in either language', () => {
    const strings = [...leafStrings(fr), ...leafStrings(en), ...leafStrings(testSignInText.fr), ...leafStrings(testSignInText.en)];

    expect(strings.filter((text) => text.trim() === '')).toEqual([]);
  });

  it('translates every French string', () => {
    const french = leafStrings(fr);

    expect(leafStrings(en).filter((text, index) => text === french[index])).toEqual([]);
  });
});
