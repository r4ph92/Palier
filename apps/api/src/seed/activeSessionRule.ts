import type { SpotStateChange } from './spotStateArguments.ts';

export type ActiveSessionDecision = 'change' | 'refuse' | 'change-and-warn';

// Freeing a spot an active session points at would leave that session on a free spot: refused unless the developer forces it.
export function decideActiveSessionRule(change: SpotStateChange, activeSessionCount: number): ActiveSessionDecision {
  if (change.state !== 'AVAILABLE' || activeSessionCount === 0) {
    return 'change';
  }
  return change.forceActiveSession ? 'change-and-warn' : 'refuse';
}

export function activeSessionRefusal(change: SpotStateChange): string {
  return `Spot ${change.spotNumber} in "${change.lotName}" is held by an active session, so it was not freed. Add --force-active-session to free it anyway.`;
}

export function activeSessionWarning(change: SpotStateChange): string {
  return `Warning: an active session still points at ${change.spotNumber}.`;
}
