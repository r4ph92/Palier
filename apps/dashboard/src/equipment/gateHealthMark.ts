import type { DashboardGateHealth } from '@palier/shared-types';
import type { StateMarkContent } from '../components/StateMark.tsx';
import type { frEquipment } from '../i18n/frEquipment.ts';
import { formatClockTime, formatDayAndMonth } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import type { Language } from '../i18n/LanguageContext.tsx';

interface HealthReading {
  readonly text: typeof frEquipment;
  readonly language: Language;
  // The server's instant: today is the server's today, whatever the operator's computer clock says.
  readonly now: Date;
}

export function gateHealthMarkOf(gate: DashboardGateHealth, { text, language, now }: HealthReading): StateMarkContent {
  if (gate.health === 'ONLINE') {
    return { tone: 'free', label: text.online };
  }
  if (gate.health === 'NEVER_HEARD' || gate.lastHeartbeatAt === null) {
    return { tone: 'muted', label: text.neverHeard };
  }
  const heardAt = new Date(gate.lastHeartbeatAt);
  const time = formatClockTime(heardAt, language);
  const label = isSameDay(heardAt, now) ? interpolate(text.silentSince, { time }) : interpolate(text.silentSinceDay, { day: formatDayAndMonth(heardAt, language), time });
  return { tone: 'danger', label };
}

function isSameDay(first: Date, second: Date): boolean {
  return first.toDateString() === second.toDateString();
}
