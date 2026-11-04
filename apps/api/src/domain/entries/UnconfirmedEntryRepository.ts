import type { OpeningWindow } from '../gates/PassageLedger.ts';

export interface ExpiredEntry {
  readonly sessionId: string;
  readonly lotId: string;
}

export interface PendingRelease {
  readonly sessionId: string;
  readonly paymentIntentId: string;
}

export interface UnconfirmedEntryRepository {
  // CREATED sessions whose barrier opened longer ago than the window, or, with no barrier command, whose scan did; database clock.
  findExpired(window: OpeningWindow): Promise<readonly ExpiredEntry[]>;
  // Locks the lot as a loop closure does, then cancels the session and frees its spot; false when a closure confirmed it first.
  cancel(entry: ExpiredEntry): Promise<boolean>;
  // At most limit holds awaiting release, least recently attempted first, each stamped as attempted now.
  claimPendingReleases(limit: number): Promise<readonly PendingRelease[]>;
  markReleased(sessionId: string): Promise<void>;
  countPendingReleases(): Promise<number>;
}
