import type { SupportedLanguage } from './i18n';

const HOURS_PER_HALF_DAY = 12;

export function formatClockTime(moment: Date, language: SupportedLanguage): string {
  const minutes = String(moment.getMinutes()).padStart(2, '0');
  if (language === 'fr') {
    return `${moment.getHours()} h ${minutes}`;
  }
  return `${twelveHourClockHour(moment.getHours())}:${minutes} ${moment.getHours() < HOURS_PER_HALF_DAY ? 'AM' : 'PM'}`;
}

function twelveHourClockHour(hours: number): number {
  return hours % HOURS_PER_HALF_DAY === 0 ? HOURS_PER_HALF_DAY : hours % HOURS_PER_HALF_DAY;
}
