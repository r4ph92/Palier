export function asRecord(candidate: unknown): Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null ? (candidate as Record<string, unknown>) : {};
}
