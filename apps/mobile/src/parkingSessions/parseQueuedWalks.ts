import type { QueuedWalk } from './OfflineWalkStore';

const LARGEST_BEACON_MINOR = 65535;

// A file cut short or written by another version gives an empty queue rather than a crash; only well-formed walks are kept.
export function parseQueuedWalks(text: string): QueuedWalk[] {
  const parsed = parseJson(text);
  return Array.isArray(parsed) ? parsed.filter(isQueuedWalk) : [];
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isQueuedWalk(value: unknown): value is QueuedWalk {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { sessionId, detectedAt, aisleMinor } = value as Record<string, unknown>;
  return typeof sessionId === 'string' && sessionId !== '' && Number.isFinite(detectedAt) && isAisleMinor(aisleMinor);
}

function isAisleMinor(value: unknown): boolean {
  return value === null || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= LARGEST_BEACON_MINOR);
}
