import { describe, expect, it } from 'vitest';
import type { SessionCheck } from '../../src/load/entryLoadDatabase.ts';
import { reportEntryLoad, type EntryLoadRun } from '../../src/load/entryLoadReport.ts';
import type { EntryAnswer, EntryOutcome } from '../../src/load/fireEntries.ts';

function admitted(spotNumber: string, latencyMilliseconds = 100): EntryOutcome {
  return { answer: 'ADMITTED', spot: `P1 ${spotNumber}`, latencyMilliseconds };
}

function refused(answer: EntryAnswer): EntryOutcome {
  return { answer, spot: null, latencyMilliseconds: 50 };
}

const tenSpots = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2', 'B-3', 'B-4', 'B-5'];
const cleanDatabase: SessionCheck = { sessions: 10, distinctSpots: 10, distinctIntents: 10, doubleBookedSpots: 0 };

function twentyDriverRun(overrides: Partial<EntryLoadRun> = {}): EntryLoadRun {
  return {
    expectedAdmissions: 10,
    outcomes: [...tenSpots.map((spot) => admitted(spot)), ...Array.from({ length: 10 }, () => refused('LOT_FULL'))],
    sessionCheck: cleanDatabase,
    maxLatencyMilliseconds: null,
    ...overrides,
  };
}

describe('reportEntryLoad', () => {
  it('passes 20 scans on 10 free spots: 10 admitted on distinct spots, 10 LOT_FULL, 10 sessions and holds (AC1)', () => {
    const report = reportEntryLoad(twentyDriverRun());

    expect(report.failures).toEqual([]);
    expect(report.summary).toBe(
      'entries=20 expected=10 admitted=10 lot_full=10 other=0 distinct_spots=10 sessions=10 session_spots=10 intents=10 double_booked=0',
    );
  });

  it('keeps latency out of the summary, so two runs compare equal (AC4)', () => {
    const fast = reportEntryLoad(twentyDriverRun());
    const slow = reportEntryLoad(twentyDriverRun({ outcomes: twentyDriverRun().outcomes.map((outcome) => ({ ...outcome, latencyMilliseconds: 900 })) }));

    expect(slow.summary).toBe(fast.summary);
    expect(slow.slowestMilliseconds).toBe(900);
  });

  it('fails when fewer entries are admitted than spots were free', () => {
    const outcomes = [...tenSpots.slice(0, 9).map((spot) => admitted(spot)), ...Array.from({ length: 11 }, () => refused('LOT_FULL'))];

    expect(reportEntryLoad(twentyDriverRun({ outcomes, sessionCheck: { ...cleanDatabase, sessions: 9, distinctSpots: 9, distinctIntents: 9 } })).failures).toEqual([
      '10 entries should have been admitted, 9 were.',
    ]);
  });

  it('fails when two admitted entries were given the same spot', () => {
    const outcomes = [...tenSpots.slice(0, 9).map((spot) => admitted(spot)), admitted('A-1'), ...Array.from({ length: 10 }, () => refused('LOT_FULL'))];

    expect(reportEntryLoad(twentyDriverRun({ outcomes })).failures).toEqual(['10 admitted entries share 9 spots.']);
  });

  it('fails when the database disagrees with the answers', () => {
    const sessionCheck: SessionCheck = { sessions: 11, distinctSpots: 10, distinctIntents: 9, doubleBookedSpots: 1 };

    expect(reportEntryLoad(twentyDriverRun({ sessionCheck })).failures).toEqual([
      '10 entries were admitted, the database holds 11 new active sessions.',
      '10 entries were admitted with 9 distinct card holds.',
      '1 spots have two active sessions.',
    ]);
  });

  it('fails on any answer other than an admission or LOT_FULL, and explains the entry limit', () => {
    const outcomes = [...twentyDriverRun().outcomes.slice(0, 18), refused('TOO_MANY_ENTRIES'), refused('PAYMENTS_UNAVAILABLE')];

    const report = reportEntryLoad(twentyDriverRun({ outcomes }));

    expect(report.summary).toContain('lot_full=8 other=2');
    expect(report.failures).toEqual([
      '1 answers were TOO_MANY_ENTRIES: the API allows 5 entries per driver in 10 minutes, restart the API between runs.',
      '1 answers were PAYMENTS_UNAVAILABLE, where only admissions and LOT_FULL are expected.',
    ]);
  });

  it('checks the latency bound only when one is given (AC2)', () => {
    const threeDrivers = { expectedAdmissions: 3, outcomes: [admitted('A-1', 400), admitted('A-2', 3200), admitted('A-3', 800)], sessionCheck: { ...cleanDatabase, sessions: 3, distinctSpots: 3, distinctIntents: 3 } };

    expect(reportEntryLoad({ ...threeDrivers, maxLatencyMilliseconds: null }).failures).toEqual([]);
    expect(reportEntryLoad({ ...threeDrivers, maxLatencyMilliseconds: 3000 }).failures).toEqual([
      'the slowest answer took 3200 ms, over the 3000 ms allowed.',
    ]);
  });
});
