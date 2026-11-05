// A parsed JSON value read field by field; anything that is not an object reads as an empty one.
export function asRecord(candidate: unknown): Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null ? (candidate as Record<string, unknown>) : {};
}
