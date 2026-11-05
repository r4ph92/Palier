import { ENTRY_LIMIT, ENTRY_WINDOW_MINUTES } from '../http/routes/entryLimit.ts';
import type { EntryRefusalCode } from '@palier/shared-types';
import type { SessionCheck } from './entryLoadDatabase.ts';
import { ADMITTED, type EntryAnswer, type EntryOutcome } from './fireEntries.ts';

export interface EntryLoadRun {
  readonly expectedAdmissions: number;
  readonly outcomes: readonly EntryOutcome[];
  readonly sessionCheck: SessionCheck;
  readonly maxLatencyMilliseconds: number | null;
}

export interface EntryLoadReport {
  // Counts only, in a fixed order, so two runs after a reseed can be compared line to line (AC4).
  readonly summary: string;
  readonly slowestMilliseconds: number;
  readonly failures: readonly string[];
}

interface Tally {
  readonly admitted: number;
  readonly lotFull: number;
  readonly others: ReadonlyMap<EntryAnswer, number>;
  readonly distinctSpots: number;
}

const LOT_FULL = 'LOT_FULL' satisfies EntryRefusalCode;
const TOO_MANY_ENTRIES = 'TOO_MANY_ENTRIES' satisfies EntryRefusalCode;

export function reportEntryLoad(run: EntryLoadRun): EntryLoadReport {
  const tally = tallyOf(run.outcomes);
  const slowestMilliseconds = Math.max(0, ...run.outcomes.map(({ latencyMilliseconds }) => latencyMilliseconds));
  return { summary: summaryOf(run, tally), slowestMilliseconds, failures: failuresOf(run, tally, slowestMilliseconds) };
}

function tallyOf(outcomes: readonly EntryOutcome[]): Tally {
  const admitted = outcomes.filter(({ answer }) => answer === ADMITTED);
  const others = new Map<EntryAnswer, number>();
  for (const { answer } of outcomes.filter(({ answer }) => answer !== ADMITTED && answer !== LOT_FULL)) {
    others.set(answer, (others.get(answer) ?? 0) + 1);
  }
  return {
    admitted: admitted.length,
    lotFull: outcomes.filter(({ answer }) => answer === LOT_FULL).length,
    others,
    distinctSpots: new Set(admitted.map(({ spot }) => spot)).size,
  };
}

function summaryOf({ outcomes, expectedAdmissions, sessionCheck }: EntryLoadRun, tally: Tally): string {
  const otherCount = [...tally.others.values()].reduce((sum, count) => sum + count, 0);
  return [
    `entries=${outcomes.length}`,
    `expected=${expectedAdmissions}`,
    `admitted=${tally.admitted}`,
    `lot_full=${tally.lotFull}`,
    `other=${otherCount}`,
    `distinct_spots=${tally.distinctSpots}`,
    `sessions=${sessionCheck.sessions}`,
    `session_spots=${sessionCheck.distinctSpots}`,
    `intents=${sessionCheck.distinctIntents}`,
    `double_booked=${sessionCheck.doubleBookedSpots}`,
  ].join(' ');
}

function failuresOf(run: EntryLoadRun, tally: Tally, slowestMilliseconds: number): string[] {
  const { admitted } = tally;
  const failures = [
    admitted === run.expectedAdmissions ? null : `${run.expectedAdmissions} entries should have been admitted, ${admitted} were.`,
    tally.distinctSpots === admitted ? null : `${admitted} admitted entries share ${tally.distinctSpots} spots.`,
    run.sessionCheck.sessions === admitted ? null : `${admitted} entries were admitted, the database holds ${run.sessionCheck.sessions} new active sessions.`,
    run.sessionCheck.distinctSpots === admitted ? null : `the ${run.sessionCheck.sessions} new sessions hold ${run.sessionCheck.distinctSpots} distinct spots.`,
    run.sessionCheck.distinctIntents === admitted ? null : `${admitted} entries were admitted with ${run.sessionCheck.distinctIntents} distinct card holds.`,
    run.sessionCheck.doubleBookedSpots === 0 ? null : `${run.sessionCheck.doubleBookedSpots} spots have two active sessions.`,
    latencyFailure(run.maxLatencyMilliseconds, slowestMilliseconds),
    ...[...tally.others].map(([answer, count]) => unexpectedAnswer(answer, count)),
  ];
  return failures.filter((failure) => failure !== null);
}

function latencyFailure(maxLatencyMilliseconds: number | null, slowestMilliseconds: number): string | null {
  if (maxLatencyMilliseconds === null || slowestMilliseconds <= maxLatencyMilliseconds) {
    return null;
  }
  return `the slowest answer took ${slowestMilliseconds} ms, over the ${maxLatencyMilliseconds} ms allowed.`;
}

function unexpectedAnswer(answer: EntryAnswer, count: number): string {
  if (answer === TOO_MANY_ENTRIES) {
    return `${count} answers were TOO_MANY_ENTRIES: the API allows ${ENTRY_LIMIT} entries per driver in ${ENTRY_WINDOW_MINUTES} minutes, restart the API between runs.`;
  }
  return `${count} answers were ${answer}, where only admissions and LOT_FULL are expected.`;
}
