import { seededNames } from './fakeDashboardData.ts';
import { translatedFrenchFragments } from './frenchStrings.ts';

// French fragments still on the page after switching to English; seeded names are data, not copy.
export function frenchLeftOnEnglishPage(): string[] {
  const shown = seededNames.reduce((text, name) => text.replaceAll(name, ''), textNodesOf(document.body).join(' '));
  return translatedFrenchFragments().filter((fragment) => containsAsWords(shown, fragment));
}

function textNodesOf(root: Node): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    texts.push(node.textContent ?? '');
  }
  return texts;
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const NOT_AFTER_WORD = '(?<![\\p{L}\\p{N}])';
const NOT_BEFORE_WORD = '(?![\\p{L}\\p{N}])';

// A fragment that starts or ends with a letter must match as whole words there ("par" is not inside "parking"); punctuation needs no boundary.
function containsAsWords(text: string, fragment: string): boolean {
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = WORD_CHARACTER.test(fragment.at(0) ?? '') ? NOT_AFTER_WORD : '';
  const after = WORD_CHARACTER.test(fragment.at(-1) ?? '') ? NOT_BEFORE_WORD : '';
  return new RegExp(`${before}${escaped}${after}`, 'u').test(text);
}
