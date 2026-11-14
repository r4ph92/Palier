import type { DashboardMapAisle } from '@palier/shared-types';
import type { BatteryStatus } from '@palier/shared-types/beaconBattery';
import type { StateMarkContent, StateTone } from '../components/StateMark.tsx';
import type { frMap } from '../i18n/frMap.ts';
import { formatPercent } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import type { Language } from '../i18n/LanguageContext.tsx';

const TONE_OF_STATUS: Readonly<Record<BatteryStatus, StateTone>> = { LOW: 'danger', OK: 'free', UNKNOWN: 'warning' };

// An unknown battery shows no percent: a reading older than 90 days says nothing about the battery today.
export function batteryMarkOf(aisle: DashboardMapAisle, text: typeof frMap, language: Language): StateMarkContent {
  const percent = aisle.batteryStatus === 'UNKNOWN' || aisle.batteryPercent === null ? '' : formatPercent(aisle.batteryPercent, language);
  return { tone: TONE_OF_STATUS[aisle.batteryStatus], label: interpolate(text.battery[aisle.batteryStatus], { percent }) };
}
