import { describe, expect, it } from 'vitest';
import type { SessionDraft } from '../../src/domain/entries/ParkingSessionRepository.ts';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PostgresUnconfirmedEntryRepository } from '../../src/infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const draft: SessionDraft = {
  driverId: 'driver-julie',
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

    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'read-active-session', 'read-free-spots', 'claim-spot', 'insert-session']);
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

describe('cancelling an unconfirmed entry under the lot lock', () => {
  it('locks the lot first, in a READ COMMITTED transaction', async () => {
    const scripted = new ScriptedSql();
    const repository = new PostgresUnconfirmedEntryRepository(scripted.database());

    await repository.cancel({ sessionId: 'session-1', lotId: draft.lotId });

    expect(scripted.isolationLevels).toEqual(['read committed']);
    expect(scripted.labels()[0]).toBe('lock-lot');
  });
});
