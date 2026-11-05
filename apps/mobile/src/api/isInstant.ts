export function isInstant(candidate: unknown): candidate is string {
  return typeof candidate === 'string' && !Number.isNaN(Date.parse(candidate));
}
