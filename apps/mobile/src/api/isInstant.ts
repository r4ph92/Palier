// An ISO instant the device can read back as a Date.
export function isInstant(candidate: unknown): candidate is string {
  return typeof candidate === 'string' && !Number.isNaN(Date.parse(candidate));
}
