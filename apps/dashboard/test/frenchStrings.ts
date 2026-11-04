import { en } from '../src/i18n/en.ts';
import { fr } from '../src/i18n/fr.ts';
import { testSignInText } from '../src/testSignIn/testSignInText.ts';

const PLACEHOLDER = /%\{\w+\}/;
const SHORTEST_CHECKED_FRAGMENT = 3;

export function leafStrings(dictionary: object): string[] {
  return Object.values(dictionary).flatMap((value: unknown) => {
    if (typeof value === 'string') {
      return [value];
    }
    return typeof value === 'object' && value !== null ? leafStrings(value) : [];
  });
}

// Every translated French string, cut at its placeholders: "Bonjour %{firstName}." is looked for as "Bonjour".
export function translatedFrenchFragments(): string[] {
  const english = new Set([...leafStrings(en), ...leafStrings(testSignInText.en)]);
  return [...leafStrings(fr), ...leafStrings(testSignInText.fr)]
    .filter((text) => !english.has(text))
    .flatMap((text) => text.split(PLACEHOLDER))
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length >= SHORTEST_CHECKED_FRAGMENT);
}
