import { ENTRY_LIMIT, ENTRY_WINDOW_MINUTES } from '../http/routes/entryLimit.ts';
import type { SessionCheck } from './entryLoadDatabase.ts';
import { ADMITTED, type EntryOutcome } from './fireEntries.ts';

export interface EntryLoadRun {
  readonly expectedAdmissions: number;
  readonly outcomes: readonly EntryOutcome[];
  readonly database: SessionCheck;
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
  readonly others: ReadonlyMap<string, number>;
  readonly distinctSpots: number;
}

const LOT_FULL = 'LOT_FULL';
const TOO_MANY_ENTRIES = 'TOO_MANY_ENTRIES';

export function reportEntryLoad(run: EntryLoadRun): EntryLoadReport {
  const tally = tallyOf(run.outcomes);
  const slowestMilliseconds = Math.max(0, ...run.outcomes.map(({ latencyMilliseconds }) => latencyMilliseconds));
  return { summary: summaryOf(run, tally), slowestMilliseconds, failures: failuresOf(run, tally, slowestMilliseconds) };
}

function tallyOf(outcomes: readonly EntryOutcome[]): Tally {
  const admitted = outcomes.filter(({ answer }) => answer === ADMITTED);
  const others = new Map<string, number>();
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

function summaryOf({ outcomes, expectedAdmissions, database }: EntryLoadRun, tally: Tally): string {
  const otherCount = [...tally.others.values()].reduce((sum, count) => sum + count, 0);
  return [
    `entries=${outcomes.length}`,
    `expected=${expectedAdmissions}`,
    `admitted=${tally.admitted}`,
    `lot_full=${tally.lotFull}`,
    `other=${otherCount}`,
    `distinct_spots=${tally.distinctSpots}`,
    `sessions=${database.sessions}`,
    `session_spots=${database.distinctSpots}`,
    `intents=${database.distinctIntents}`,
    `double_booked=${database.doubleBookedSpots}`,
  ].join(' ');
}

function failuresOf(run: EntryLoadRun, tally: Tally, slowestMilliseconds: number): string[] {
  const { admitted } = tally;
  const failures = [
    admitted === run.expectedAdmissions ? null : `${run.expectedAdmissions} entries should have been admitted, ${admitted} were.`,
    tally.distinctSpots === admitted ? null : `${admitted} admitted entries share ${tally.distinctSpots} spots.`,
    run.database.sessions === admitted ? null : `${admitted} entries were admitted, the database holds ${run.database.sessions} new active sessions.`,
    run.database.distinctSpots === admitted ? null : `the ${run.database.sessions} new sessions hold ${run.database.distinctSpots} distinct spots.`,
    run.database.distinctIntents === admitted ? null : `${admitted} entries were admitted with ${run.database.distinctIntents} distinct card holds.`,
    run.database.doubleBookedSpots === 0 ? null : `${run.database.doubleBookedSpots} spots have two active sessions.`,
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

function unexpectedAnswer(answer: string, count: number): string {
  if (answer === TOO_MANY_ENTRIES) {
    return `${count} answers were TOO_MANY_ENTRIES: the API allows ${ENTRY_LIMIT} entries per driver in ${ENTRY_WINDOW_MINUTES} minutes, restart the API between runs.`;
  }
  return `${count} answers were ${answer}, where only admissions and LOT_FULL are expected.`;
}
