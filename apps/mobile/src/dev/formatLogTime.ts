export function formatLogTime(moment: Date): string {
  return `${moment.getHours()} h ${twoDigits(moment.getMinutes())} min ${twoDigits(moment.getSeconds())} s`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
