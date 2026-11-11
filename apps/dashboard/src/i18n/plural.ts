import { formatCount } from './formatNumbers.ts';
import { interpolate } from './interpolate.ts';
import type { Language } from './LanguageContext.tsx';

export interface PluralForms {
  readonly one: string;
  readonly other: string;
}

// French counts 0 and 1 as singular (« 0 garantie »), English only 1 (« 0 guaranteed spots »).
export function pluralOf(forms: PluralForms, count: number, language: Language): string {
  const form = new Intl.PluralRules(language).select(count) === 'one' ? forms.one : forms.other;
  return interpolate(form, { count: formatCount(count, language) });
}
