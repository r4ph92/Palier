export const PRESENCE_STATUS_ID = 'stale-session-status';

export function presenceButtonId(sessionId: string): string {
  return `stale-session-${sessionId}-presence`;
}

export function presenceErrorId(sessionId: string): string {
  return `stale-session-${sessionId}-presence-error`;
}
