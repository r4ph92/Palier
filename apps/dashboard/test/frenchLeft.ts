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

// A short fragment such as "par" counts only as whole words, so the English "parking" does not hide inside it.
function containsAsWords(text: string, fragment: string): boolean {
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text);
}
