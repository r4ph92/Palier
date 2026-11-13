// A new order names every level of the lot exactly once: a stale list, a foreign id or a missing one is refused whole.
export function isOrderOfEveryLevel(requestedIds: readonly string[], currentIds: readonly string[]): boolean {
  const requested = new Set(requestedIds);
  return requested.size === requestedIds.length && requested.size === currentIds.length && currentIds.every((id) => requested.has(id));
}
