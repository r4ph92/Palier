import { describe, expect, it } from 'vitest';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PostgresUnconfirmedEntryRepository } from '../../src/infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const NOW = new Date('2026-11-05T14:05:00Z');
const WINDOW = { withinMilliseconds: 60_000 };
const cancelledWithHold = { assigned_spot_id: 'spot-A-1', consumed_spot_hold_id: 'hold-julie' };
const cancelledWithoutHold = { assigned_spot_id: 'spot-A-1', consumed_spot_hold_id: null };

function cancelledSession(row: Record<string, unknown> | undefined): ScriptedSql {
  return new ScriptedSql().answer('read-session-lot', [{ lot_id: 'lot-demo' }]).answer('cancel-session', row === undefined ? [] : [row]);
}

async function cancelOnRollback(scripted: ScriptedSql): Promise<void> {
  await new PostgresParkingSessionRepository(scripted.database(), WINDOW, () => NOW).cancel('session-1');
}

function spotStateAfter(scripted: ScriptedSql): unknown {
  return scripted.statement('free-held-spot')?.params[0];
}

describe('cancelling an entry that used a hold', () => {
  it('puts the hold back and keeps its spot held, under the lot lock', async () => {
    const scripted = cancelledSession(cancelledWithHold).answer('restore-spot-hold', [{ id: 'hold-julie' }]).answer('free-held-spot', [{ id: 'spot-A-1' }]);

    await cancelOnRollback(scripted);

    expect(scripted.labels()).toEqual(['read-session-lot', 'lock-lot', 'cancel-session', 'restore-spot-hold', 'free-held-spot']);
    expect(scripted.isolationLevels).toEqual(['read committed']);
    expect(spotStateAfter(scripted)).toBe('HELD');
  });

  it('compares the end time with the API clock and never moves it', async () => {
    const scripted = cancelledSession(cancelledWithHold).answer('restore-spot-hold', [{ id: 'hold-julie' }]).answer('free-held-spot', [{ id: 'spot-A-1' }]);

    await cancelOnRollback(scripted);

    const restore = scripted.statement('restore-spot-hold');
    expect(restore?.params).toContain(NOW.toISOString());
    expect(restore?.text).not.toMatch(/set status = 'ACTIVE',/);
    expect(restore?.text).not.toMatch(/expires_at =/);
  });

  it('frees the spot and ends the hold as expired when it ran out before the cancellation', async () => {
    const scripted = cancelledSession(cancelledWithHold);

    await cancelOnRollback(scripted);

    expect(scripted.count('expire-spot-holds')).toBe(1);
    expect(scripted.statement('expire-spot-holds')?.params).toContain(NOW.toISOString());
    expect(spotStateAfter(scripted)).toBe('AVAILABLE');
  });

  it('frees the spot when the driver holds another spot now, leaving that hold alone', async () => {
    const scripted = cancelledSession(cancelledWithHold);

    await cancelOnRollback(scripted);

    expect(scripted.statement('restore-spot-hold')?.text).toMatch(/not exists \(select 1 from spot_hold other where other\.user_id = spot_hold\.user_id and other\.status = 'ACTIVE'\)/);
    expect(spotStateAfter(scripted)).toBe('AVAILABLE');
  });

  it('writes the held spot with the API clock, not the database one', async () => {
    const scripted = cancelledSession(cancelledWithHold).answer('restore-spot-hold', [{ id: 'hold-julie' }]).answer('free-held-spot', [{ id: 'spot-A-1' }]);

    await cancelOnRollback(scripted);

    expect(scripted.statement('free-held-spot')?.params).toContain(NOW.toISOString());
  });

  it('puts the hold back to used when the spot was no longer assigned', async () => {
    const scripted = cancelledSession(cancelledWithHold).answer('restore-spot-hold', [{ id: 'hold-julie' }]);

    await cancelOnRollback(scripted);

    expect(scripted.statements.at(-1)?.text).toMatch(/update spot_hold set status = 'USED'/);
  });

  it('restores nothing for an entry made without a hold', async () => {
    const scripted = cancelledSession(cancelledWithoutHold);

    await cancelOnRollback(scripted);

    expect(scripted.count('restore-spot-hold')).toBe(0);
    expect(scripted.count('expire-spot-holds')).toBe(0);
    expect(spotStateAfter(scripted)).toBe('AVAILABLE');
  });

  it('does nothing when a second cancellation finds the session no longer CREATED', async () => {
    const scripted = cancelledSession(undefined);

    await cancelOnRollback(scripted);

    expect(scripted.labels()).toEqual(['read-session-lot', 'lock-lot', 'cancel-session']);
  });
});

describe('the cancellation job', () => {
  it('restores the hold with the same rule, on the clock it was given', async () => {
    const scripted = new ScriptedSql().answer('cancel-session', [cancelledWithHold]).answer('restore-spot-hold', [{ id: 'hold-julie' }]).answer('free-held-spot', [{ id: 'spot-A-1' }]);

    const cancelled = await new PostgresUnconfirmedEntryRepository(scripted.database(), () => NOW).cancel({ sessionId: 'session-1', lotId: 'lot-demo' });

    expect(cancelled).toBe(true);
    expect(scripted.statement('restore-spot-hold')?.params).toContain(NOW.toISOString());
    expect(spotStateAfter(scripted)).toBe('HELD');
  });
});

describe('an entry that uses a hold', () => {
  const draft = {
    driverId: 'driver-julie',
    now: NOW,
    vehicleId: 'vehicle-julie',
    plate: 'ABC 123',
    needs: { isElectric: false, hasAccessiblePermit: false, isOversize: false },
    lotId: 'lot-demo',
    entryGateId: 'gate-entree-demo',
    authorizedCents: 2500,
    pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
    cardLast4: '4242',
  };
  const heldSpot = { hold_id: 'hold-julie', spot_id: 'spot-A-1', is_ev: false, is_accessible: false, is_oversize: false };
  const freeSpot = { id: 'spot-B-1', number: 'B-1', level_order: 1, aisle_code: 'B', distance_to_exit: 1, needs_check: false, is_ev: false, is_accessible: false, is_oversize: false };

  it('records which hold it consumed', async () => {
    const scripted = new ScriptedSql()
      .answer('read-held-spot', [heldSpot])
      .answer('use-spot-hold', [{ id: 'hold-julie' }])
      .answer('assign-held-spot', [{ id: 'spot-A-1', number: 'A-1', aisle_code: 'A', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-1' }]);

    await new PostgresParkingSessionRepository(scripted.database(), WINDOW, () => NOW).openOrReplay(draft);

    expect(scripted.insertedSessions).toEqual([expect.objectContaining({ consumedSpotHoldId: 'hold-julie' })]);
  });

  it('records the card last four on the session for its receipt', async () => {
    const scripted = new ScriptedSql()
      .answer('read-free-spots', [freeSpot])
      .answer('claim-spot', [{ id: 'spot-B-1', number: 'B-1', aisle_code: 'B', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-1' }]);

    await new PostgresParkingSessionRepository(scripted.database(), WINDOW, () => NOW).openOrReplay(draft);

    expect(scripted.insertedSessions).toEqual([expect.objectContaining({ cardLast4: '4242' })]);
  });

  it('records no hold when there was none', async () => {
    const scripted = new ScriptedSql()
      .answer('read-free-spots', [freeSpot])
      .answer('claim-spot', [{ id: 'spot-B-1', number: 'B-1', aisle_code: 'B', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-1' }]);

    await new PostgresParkingSessionRepository(scripted.database(), WINDOW, () => NOW).openOrReplay(draft);

    expect(scripted.insertedSessions).toEqual([expect.objectContaining({ consumedSpotHoldId: null })]);
  });
});
