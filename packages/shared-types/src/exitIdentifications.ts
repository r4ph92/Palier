import type { SessionExitMethod } from './sessionTimeline.ts';

export const EXIT_SHARE_WINDOW_DAYS = 30;

// Staff counts the stale sessions an operator closed at their last known proof (decision 043, amending 045).
export const EXIT_SHARE_METHODS = ['BEACON', 'APP', 'PLATE', 'TRANSPONDER', 'STAFF'] as const;
export type ExitShareMethod = (typeof EXIT_SHARE_METHODS)[number];

// Counts only: no plate, user or payment ever reaches this page.
export interface LotExitShares {
  readonly lotName: string;
  readonly totalExits: number;
  readonly counts: Readonly<Record<ExitShareMethod, number>>;
}

// Fails to compile when a method a session can record is missing from the shown list.
export type RecordedMethodsAreShown = [SessionExitMethod] extends [ExitShareMethod] ? true : never;
export const RECORDED_METHODS_ARE_SHOWN: RecordedMethodsAreShown = true;
