import type { EntrySessionState } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import type { WalkingSignal } from '../../src/domain/parkingSessions/ParkedPresumption.ts';
import { PostgresParkedAnswerRepository } from '../../src/infrastructure/postgres/PostgresParkedAnswerRepository.ts';
import { PostgresParkedPresumptionRepository } from '../../src/infrastructure/postgres/PostgresParkedPresumptionRepository.ts';
import { onlyAppendedSessionEvent } from './fakes/appendedSessionEvents.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const JULIE_ID = '00000000-0000-4000-8000-000000000501';
const SESSION_ID = '00000000-0000-4000-8000-000000000951';
const LOT_ID = '00000000-0000-4000-8000-000000000201';
const AISLE_A_ID = '00000000-0000-4000-8000-000000000401';
const AISLE_B_ID = '00000000-0000-4000-8000-000000000402';
const SPOT_A1_ID = '00000000-0000-4000-8000-0000000003a1';
const SPOT_B3_ID = '00000000-0000-4000-8000-0000000003b3';
const WALKED_AT = new Date('2026-11-14T18:05:00Z');
const PARKED_AT = { parked_at: WALKED_AT.toISOString() };

const aisleA = { detected_aisle_id: AISLE_A_ID, detected_aisle_code: 'A', detected_aisle_minor: 1 };
const aisleB = { detected_aisle_id: AISLE_B_ID, detected_aisle_code: 'B', detected_aisle_minor: 2 };
const noAisle = { detected_aisle_id: null, detected_aisle_code: null, detected_aisle_minor: null };

function factsRow(detected: typeof aisleA | typeof noAisle, state: EntrySessionState = 'ENTRY_CONFIRMED') {
  return { state, parked_at: null, lot_id: LOT_ID, assigned_spot_id: SPOT_A1_ID, assigned_aisle_id: AISLE_A_ID, ...detected };
}

function walkIn(minor: number | null): WalkingSignal {
  return { sessionId: SESSION_ID, driverId: JULIE_ID, detectedAt: WALKED_AT, detectedAisleMinor: minor };
}

function walkWith(scripted: ScriptedSql, signal: WalkingSignal) {
  return new PostgresParkedPresumptionRepository(scripted.database()).presume(signal);
}

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function aisleDetectedParam(scripted: ScriptedSql): unknown {
  const json = scripted.statement('presume-parked')?.params.find((param) => typeof param === 'string' && param.startsWith('{'));
  return json === undefined ? undefined : JSON.parse(String(json));
}

describe('Julie walks away in her assigned aisle A (story #156)', () => {
  function walkInAisleA(): ScriptedSql {
    return new ScriptedSql().answer('read-walk-facts', [factsRow(aisleA)]).answer('presume-parked', [PARKED_AT, PARKED_AT]);
  }

  it('presumes the session and logs both events in one statement, still without a lock or a transaction (decision 019)', async () => {
    const scripted = walkInAisleA();

    await expect(walkWith(scripted, walkIn(1))).resolves.toEqual({ outcome: 'recorded', state: 'PARKED_PRESUMED', parkedAt: WALKED_AT });

    expect(scripted.labels()).toEqual(['read-walk-facts', 'presume-parked']);
    expect(scripted.transactionsOf('presume-parked')).toEqual([null]);
    const statement = oneLine(scripted.statement('presume-parked')?.text);
    expect(statement).toMatch(/^with presumed as \( update parking_session set state = 'PARKED_PRESUMED'/);
    expect(statement.match(/insert into event_log/g)).toHaveLength(1);
  });

  it('writes the aisle before the presumption from one ordered insert, so the sequence keeps that order', async () => {
    const scripted = walkInAisleA();

    await walkWith(scripted, walkIn(1));

    const statement = oneLine(scripted.statement('presume-parked')?.text);
    expect(statement).toMatch(/values \(1, 'AISLE_DETECTED', \$\d+::jsonb\), \(2, 'PARKING_PRESUMED', jsonb_build_object\(/);
    expect(statement).toMatch(/as walk_event\(ordinal, kind, payload\) order by walk_event\.ordinal/);
    expect(statement).not.toMatch(/\), \w+ as \(insert into event_log/);
  });

  it('logs the detected aisle A as the assigned one, and the presumption on foot on A-1', async () => {
    const scripted = walkInAisleA();

    await walkWith(scripted, walkIn(1));

    expect(aisleDetectedParam(scripted)).toEqual({ aisleId: AISLE_A_ID, aisleCode: 'A', beaconMinor: 1, isAssignedAisle: true });
    const statement = oneLine(scripted.statement('presume-parked')?.text);
    expect(statement).toContain(`jsonb_build_object('evidence', 'ON_FOOT', 'spotId', spot.id, 'spotNumber', spot.number)`);
    expect(statement).toContain('join spot on spot.id = presumed.assigned_spot_id');
  });

  it('dates both events with the parked_at the update kept (decision 019), and keeps the purge 2160 h after it', async () => {
    const scripted = walkInAisleA();

    await walkWith(scripted, walkIn(1));

    const statement = scripted.statement('presume-parked');
    expect(oneLine(statement?.text)).toMatch(
      /select presumed\.id, presumed\.lot_id, walk_event\.kind, walk_event\.payload, presumed\.parked_at, presumed\.parked_at \+ make_interval\(hours => \$\d+::int\)/,
    );
    expect(statement?.params).toContain(2160);
    expect(oneLine(statement?.text)).toMatch(/returning occurred_at as parked_at$/);
  });

  it('reads the code and the minor of the detected aisle with the walk facts', async () => {
    const scripted = walkInAisleA();

    await walkWith(scripted, walkIn(1));

    expect(scripted.statement('read-walk-facts')?.text).toMatch(/detected\.id as detected_aisle_id, detected\.code as detected_aisle_code, detected\.beacon_minor as detected_aisle_minor/);
  });
});

describe('a walk with no known aisle (story #156)', () => {
  it.each([
    ['no aisle at all', null, []],
    ['a minor the lot does not know, or the exit lane', 9, [factsRow(noAisle)]],
  ] as const)('logs the presumption on foot alone for %s', async (_case, minor, facts) => {
    const scripted = new ScriptedSql().answer('read-walk-facts', [...facts]).answer('presume-parked', [PARKED_AT]);

    await expect(walkWith(scripted, walkIn(minor))).resolves.toMatchObject({ outcome: 'recorded' });

    const statement = oneLine(scripted.statement('presume-parked')?.text);
    expect(statement).toMatch(/cross join lateral \(values \(2, 'PARKING_PRESUMED', jsonb_build_object\('evidence', 'ON_FOOT'/);
    expect(statement).not.toContain('AISLE_DETECTED');
    expect(scripted.count('append-session-event')).toBe(0);
  });
});

describe('Julie walks away in aisle B, then answers B-3 (story #156)', () => {
  function walkInAisleB(): ScriptedSql {
    return new ScriptedSql()
      .answer('read-walk-facts', [factsRow(aisleB)])
      .answer('ask-where-parked', [{ ...PARKED_AT, assigned_spot_id: SPOT_A1_ID }])
      .answer('flag-assigned-spot', [{ id: SPOT_A1_ID }]);
  }

  it('logs aisle B in the question transaction, under the lot lock', async () => {
    const scripted = walkInAisleB();

    await expect(walkWith(scripted, walkIn(2))).resolves.toMatchObject({ state: 'PARKED_UNCONFIRMED' });

    expect(scripted.labels()).toEqual(['read-walk-facts', 'limit-lock-wait', 'lock-lot', 'ask-where-parked', 'flag-assigned-spot', 'append-session-event']);
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('ask-where-parked'));
    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('lock-lot'));
  });

  it('logs the other aisle, at the parked_at the question kept', async () => {
    const scripted = walkInAisleB();

    await walkWith(scripted, walkIn(2));

    const detected = onlyAppendedSessionEvent(scripted);
    expect(detected.kind).toBe('AISLE_DETECTED');
    expect(detected.payload).toEqual({ aisleId: AISLE_B_ID, aisleCode: 'B', beaconMinor: 2, isAssignedAisle: false });
    expect([detected.sessionId, detected.lotId]).toEqual([SESSION_ID, LOT_ID]);
    expect(detected.occurredAtText).toMatch(/select "parked_at" from parking_session where id = \$\d+/);
  });

  it('logs her answer with the spot she gave, at the answer time, in the answer transaction', async () => {
    const scripted = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_UNCONFIRMED', assigned_spot_id: SPOT_A1_ID, assigned_spot_state: 'OCCUPIED_UNKNOWN', number: null, aisle_code: null, level_code: null }])
      .answer('lock-answered-spot', [{ id: SPOT_B3_ID, state: 'AVAILABLE', number: 'B-3', aisle_code: 'B', level_code: 'P1' }])
      .answer('occupy-answered-spot', [{ id: SPOT_B3_ID }])
      .answer('confirm-parked-spot', [{ id: SESSION_ID }]);

    await new PostgresParkedAnswerRepository(scripted.database()).answer({ sessionId: SESSION_ID, driverId: JULIE_ID, spotNumber: 'B-3' });

    expect(scripted.transactionsOf('append-session-event')).toEqual(scripted.transactionsOf('confirm-parked-spot'));
    const confirmed = onlyAppendedSessionEvent(scripted);
    expect(confirmed.kind).toBe('PARKING_CONFIRMED');
    expect(confirmed.payload).toEqual({ spotId: SPOT_B3_ID, spotNumber: 'B-3' });
    expect(confirmed.occurredAtText).toMatch(/select "parked_answered_at" from parking_session where id = \$\d+/);
  });

  it('logs no answer for a spot refused without any write', async () => {
    const scripted = new ScriptedSql()
      .answer('read-session-lot', [{ lot_id: LOT_ID }])
      .answer('lock-answering-session', [{ state: 'PARKED_UNCONFIRMED', assigned_spot_id: SPOT_A1_ID, assigned_spot_state: 'OCCUPIED_UNKNOWN', number: null, aisle_code: null, level_code: null }])
      .answer('lock-answered-spot', [{ id: SPOT_B3_ID, state: 'OCCUPIED', number: 'B-3', aisle_code: 'B', level_code: 'P1' }]);

    await expect(new PostgresParkedAnswerRepository(scripted.database()).answer({ sessionId: SESSION_ID, driverId: JULIE_ID, spotNumber: 'B-3' })).resolves.toEqual({ outcome: 'spot-taken' });
    expect(scripted.count('append-session-event')).toBe(0);
  });
});

describe('the same walk sent again (story #156)', () => {
  it.each(['PARKED_PRESUMED', 'PARKED_UNCONFIRMED'] as const)('logs nothing more for a session already %s', async (state) => {
    const scripted = new ScriptedSql().answer('read-walk-facts', [{ ...factsRow(aisleA, state), ...PARKED_AT }]);

    await expect(walkWith(scripted, walkIn(1))).resolves.toMatchObject({ outcome: 'already' });
    expect(scripted.labels()).toEqual(['read-walk-facts']);
  });

  it('logs nothing more for a walk without an aisle once the session is presumed', async () => {
    const scripted = new ScriptedSql().answer('read-unchanged-session', [{ state: 'PARKED_PRESUMED', ...PARKED_AT }]);

    await expect(walkWith(scripted, walkIn(null))).resolves.toMatchObject({ outcome: 'already' });
    expect(scripted.labels()).toEqual(['presume-parked', 'read-unchanged-session']);
    expect(scripted.count('append-session-event')).toBe(0);
  });

  it('logs the walk once when a first attempt found the spot moved and the second wrote', async () => {
    const scripted = new ScriptedSql()
      .answer('read-walk-facts', [factsRow(aisleA)], [factsRow(aisleA)])
      .answer('presume-parked', [], [PARKED_AT, PARKED_AT]);

    await expect(walkWith(scripted, walkIn(1))).resolves.toMatchObject({ outcome: 'recorded' });
    expect(scripted.labels()).toEqual(['read-walk-facts', 'presume-parked', 'read-walk-facts', 'presume-parked']);
    expect(scripted.count('append-session-event')).toBe(0);
  });

  it('logs the other aisle only in the attempt whose question was written', async () => {
    const scripted = new ScriptedSql()
      .answer('read-walk-facts', [factsRow(aisleB)], [factsRow(aisleB)])
      .answer('ask-where-parked', [], [{ ...PARKED_AT, assigned_spot_id: SPOT_A1_ID }])
      .answer('flag-assigned-spot', [{ id: SPOT_A1_ID }]);

    await walkWith(scripted, walkIn(2));

    expect(scripted.count('append-session-event')).toBe(1);
    expect(scripted.transactionsOf('append-session-event')).toEqual([scripted.transactionsOf('ask-where-parked')[1]]);
  });
});
