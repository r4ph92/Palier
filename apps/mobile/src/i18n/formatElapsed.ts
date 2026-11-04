import type { SupportedLanguage } from './i18n';
import { NO_BREAK_SPACE } from './spaces';

const MINUTES_PER_HOUR = 60;

// 3 h 15 in French and 3 h 15 min in English; under an hour, minutes only.
export function formatElapsed(elapsedMinutes: number, language: SupportedLanguage): string {
  const hours = Math.floor(elapsedMinutes / MINUTES_PER_HOUR);
  const minutes = elapsedMinutes % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${minutes}${NO_BREAK_SPACE}min`;
  }
  const clock = `${hours}${NO_BREAK_SPACE}h${NO_BREAK_SPACE}${String(minutes).padStart(2, '0')}`;
  return language === 'fr' ? clock : `${clock}${NO_BREAK_SPACE}min`;
}
