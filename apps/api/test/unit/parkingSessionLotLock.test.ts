import { describe, expect, it } from 'vitest';
import type { SessionDraft } from '../../src/domain/entries/ParkingSessionRepository.ts';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PostgresUnconfirmedEntryRepository } from '../../src/infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const NOW = new Date('2026-11-05T12:00:00Z');
const draft: SessionDraft = {
  driverId: 'driver-julie',
  now: NOW,
  vehicleId: 'vehicle-julie',
  plate: 'ABC 123',
  needs: { isElectric: false, hasAccessiblePermit: false, isOversize: false },
  lotId: 'lot-demo',
  entryGateId: 'gate-entree-demo',
  authorizedCents: 2500,
  pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
};

const freeSpot = {
  id: 'spot-A-1',
  number: 'A-1',
  level_order: 1,
  aisle_code: 'A',
  distance_to_exit: 1,
  needs_check: false,
  is_ev: false,
  is_accessible: false,
  is_oversize: false,
};

function scriptedEntry(): ScriptedSql {
  return new ScriptedSql()
    .answer('read-free-spots', [freeSpot])
    .answer('claim-spot', [{ id: 'spot-A-1', number: 'A-1', aisle_code: 'A', level_code: 'P1' }])
    .answer('insert-session', [{ id: 'session-1' }]);
}

async function openEntry(scripted: ScriptedSql) {
  const repository = new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 });
  return repository.openOrReplay(draft);
}

describe('opening an entry under the lot lock', () => {
  it('bounds the lock wait, locks the lot, then reads the driver, claims a spot and inserts the session', async () => {
    const scripted = scriptedEntry();

    await openEntry(scripted);

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'read-active-session', 'read-held-spot', 'read-free-spots', 'claim-spot', 'insert-session']);
  });

  it('runs every statement on the transaction, never on the shared connection', async () => {
    const scripted = scriptedEntry();

    await openEntry(scripted);

    expect(scripted.statements.every(({ onTransaction }) => onTransaction)).toBe(true);
  });

  it('opens its transaction in READ COMMITTED, so the reads after the lock wait see the previous holder', async () => {
    const scripted = scriptedEntry();

    await openEntry(scripted);

    expect(scripted.isolationLevels).toEqual(['read committed']);
  });

  it('locks the scanned lot', async () => {
    const scripted = scriptedEntry();

    await openEntry(scripted);

    expect(scripted.statements.find(({ label }) => label === 'lock-lot')?.params).toEqual([draft.lotId]);
  });

  it('opens a new session on the claimed spot', async () => {
    expect(await openEntry(scriptedEntry())).toEqual({ kind: 'opened', session: { id: 'session-1', spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' } } });
  });
});

describe('opening an entry for a driver who holds a spot', () => {
  const heldSpotRow = { hold_id: 'hold-1', spot_id: 'spot-B-2', is_ev: false, is_accessible: false, is_oversize: false };
  const assignedRow = { id: 'spot-B-2', number: 'B-2', aisle_code: 'B', level_code: 'P1' };

  function scriptedHeldEntry(): ScriptedSql {
    return new ScriptedSql()
      .answer('read-held-spot', [heldSpotRow])
      .answer('use-spot-hold', [{ id: 'hold-1' }])
      .answer('assign-held-spot', [assignedRow])
      .answer('insert-session', [{ id: 'session-1' }]);
  }

  it('uses the hold and assigns its spot without claiming another', async () => {
    const scripted = scriptedHeldEntry();

    const opening = await openEntry(scripted);

    expect(opening).toEqual({ kind: 'opened', session: { id: 'session-1', spot: { number: 'B-2', levelCode: 'P1', aisleCode: 'B' } } });
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'read-active-session', 'read-held-spot', 'use-spot-hold', 'assign-held-spot', 'insert-session']);
  });

  it('looks for the hold of this driver in the scanned lot only, still running at the API clock instant', async () => {
    const scripted = scriptedHeldEntry();

    await openEntry(scripted);

    const read = scripted.statements.find(({ label }) => label === 'read-held-spot');
    expect(read?.params).toEqual([draft.driverId, draft.lotId, NOW.toISOString()]);
    expect(read?.text).toContain(`status = 'ACTIVE'`);
    expect(read?.text).toContain('expires_at >');
  });

  it('ends only an active hold that is still running, and only the one it read', async () => {
    const scripted = scriptedHeldEntry();

    await openEntry(scripted);

    const used = scripted.statements.find(({ label }) => label === 'use-spot-hold');
    expect(used?.text).toContain(`status = 'ACTIVE'`);
    expect(used?.text).toContain('expires_at >');
    expect(used?.params).toEqual(['hold-1', draft.driverId, draft.lotId, NOW.toISOString()]);
  });

  it('turns only a held spot into the assigned one', async () => {
    const scripted = scriptedHeldEntry();

    await openEntry(scripted);

    const assigned = scripted.statements.find(({ label }) => label === 'assign-held-spot');
    expect(assigned?.text).toContain(`state = 'HELD'`);
    expect(assigned?.params).toContain('spot-B-2');
  });

  it('asks for a free spot when she has no usable hold, and refuses a full lot', async () => {
    const scripted = new ScriptedSql();

    expect(await openEntry(scripted)).toBeNull();
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'read-active-session', 'read-held-spot', 'read-free-spots']);
  });

  it('leaves the hold alone and claims a free spot when the held spot no longer fits her vehicle', async () => {
    const scripted = new ScriptedSql().answer('read-held-spot', [{ ...heldSpotRow, is_accessible: true }]).answer('read-free-spots', [freeSpot]).answer('claim-spot', [assignedRow]).answer('insert-session', [{ id: 'session-1' }]);

    await openEntry(scripted);

    expect(scripted.count('use-spot-hold')).toBe(0);
    expect(scripted.count('claim-spot')).toBe(1);
  });

  it('rolls the entry back when the hold was used but its spot was no longer held', async () => {
    const scripted = new ScriptedSql().answer('read-held-spot', [heldSpotRow]).answer('use-spot-hold', [{ id: 'hold-1' }]);

    await expect(openEntry(scripted)).rejects.toThrow('was not held');
  });

  const replayableSessionRow = {
    id: 'session-0',
    lot_id: draft.lotId,
    entry_gate_id: draft.entryGateId,
    state: 'CREATED',
    is_within_opening_window: true,
    number: 'A-1',
    aisle_code: 'A',
    level_code: 'P1',
  };

  it('does not look at holds when the scan replays an entry still opening', async () => {
    const scripted = new ScriptedSql().answer('read-active-session', [replayableSessionRow]);

    await openEntry(scripted);

    expect(scripted.count('read-held-spot')).toBe(0);
  });
});

describe('cancelling an unconfirmed entry under the lot lock', () => {
  it('locks the lot first, in a READ COMMITTED transaction', async () => {
    const scripted = new ScriptedSql();
    const repository = new PostgresUnconfirmedEntryRepository(scripted.database());

    await repository.cancel({ sessionId: 'session-1', lotId: draft.lotId });

    expect(scripted.isolationLevels).toEqual(['read committed']);
    expect(scripted.labels()[0]).toBe('lock-lot');
  });
});
