import { formatCount } from './formatNumbers.ts';
import { interpolate } from './interpolate.ts';
import type { Language } from './LanguageContext.tsx';

export interface PluralForms {
  readonly one: string;
  readonly other: string;
}

// French counts 0 and 1 as singular (« 0 garantie »), English only 1 (« 0 guaranteed spots »).
export function pluralOf(forms: PluralForms, count: number, language: Language): string {
  return interpolate(pluralFormOf(forms, count, language), { count: formatCount(count, language) });
}

export function pluralFormOf(forms: PluralForms, count: number, language: Language): string {
  return new Intl.PluralRules(language).select(count) === 'one' ? forms.one : forms.other;
}
