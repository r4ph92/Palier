import type { SessionExitMethod } from './sessionTimeline.ts';

export const EXIT_SHARE_WINDOW_DAYS = 30;

// Staff is listed from the start so the list does not change when a staff exit exists (decision 045); nothing records one yet, so it reads 0.
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
