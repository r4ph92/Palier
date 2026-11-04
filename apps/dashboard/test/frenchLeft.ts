import { seededNames } from './fakeDashboardData.ts';
import { translatedFrenchFragments } from './frenchStrings.ts';

// French fragments still on the page after switching to English; seeded names are data, not copy.
export function frenchLeftOnEnglishPage(): string[] {
  const shown = seededNames.reduce((text, name) => text.replaceAll(name, ''), document.body.textContent);
  return translatedFrenchFragments().filter((fragment) => shown.includes(fragment));
}
