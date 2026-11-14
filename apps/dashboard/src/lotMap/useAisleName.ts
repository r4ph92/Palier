import type { DashboardMapAisle } from '@palier/shared-types';
import { useText } from '../i18n/LanguageContext.tsx';

// The exit lane is named by its role, never by its stored code, so the page reads in the operator's language.
export function useAisleName(): (aisle: DashboardMapAisle) => string {
  const text = useText();
  return (aisle) => (aisle.isExitLane ? text.map.exitLane : aisle.code);
}
