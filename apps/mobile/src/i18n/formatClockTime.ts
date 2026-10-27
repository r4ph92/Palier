import type { SupportedLanguage } from './i18n';

const HOURS_PER_HALF_DAY = 12;
const NO_BREAK_SPACE = '\u00A0';

export function formatClockTime(moment: Date, language: SupportedLanguage): string {
  const minutes = String(moment.getMinutes()).padStart(2, '0');
  if (language === 'fr') {
    return `${moment.getHours()}${NO_BREAK_SPACE}h${NO_BREAK_SPACE}${minutes}`;
  }
  const period = moment.getHours() < HOURS_PER_HALF_DAY ? 'AM' : 'PM';
  return `${twelveHourClockHour(moment.getHours())}:${minutes}${NO_BREAK_SPACE}${period}`;
}

function twelveHourClockHour(hours: number): number {
  return hours % HOURS_PER_HALF_DAY === 0 ? HOURS_PER_HALF_DAY : hours % HOURS_PER_HALF_DAY;
}
