import { NO_BREAK_SPACE } from './spaces';

const MINUTES_PER_HOUR = 60;

// « 3 h 15 » in both languages, as the receipt reads; under an hour, minutes only.
export function formatReceiptDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / MINUTES_PER_HOUR);
  const minutes = durationMinutes % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${minutes}${NO_BREAK_SPACE}min`;
  }
  return `${hours}${NO_BREAK_SPACE}h${NO_BREAK_SPACE}${String(minutes).padStart(2, '0')}`;
}
