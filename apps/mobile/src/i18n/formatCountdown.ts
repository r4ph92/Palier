const SECONDS_PER_MINUTE = 60;

// « 14:59 », the same in French and English; read aloud in words, never digit by digit.
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
