import { GATE_NAME_LENGTH, MAX_GATES_PER_LOT } from '@palier/shared-types/gateDraft';
import { useMemo } from 'react';
import { formatCount } from '../i18n/formatNumbers.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';

// Fills the limits in the gates' errors, so the sentences follow the shared rule.
export function useGateLimitValues(): Readonly<Record<string, string>> {
  const { language } = useLanguage();
  return useMemo(() => ({ gateNameMaximum: formatCount(GATE_NAME_LENGTH.maximum, language), gatesPerLotMaximum: formatCount(MAX_GATES_PER_LOT, language) }), [language]);
}
