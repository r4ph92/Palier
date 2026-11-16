import { describe, expect, it } from 'vitest';
import { EntryRefusedError } from '../../src/domain/entries/EntryRefusedError.ts';
import type { SessionDraft } from '../../src/domain/entries/ParkingSessionRepository.ts';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PARKING_DEMO_OCCUPANCY_ROW, ScriptedSql } from './fakes/scriptedSql.ts';

const draft: SessionDraft = {
  driverId: 'driver-julie',
  now: new Date('2026-11-15T12:00:00Z'),
  vehicleId: 'vehicle-julie',
  plate: 'ABC 123',
  needs: { isElectric: false, hasAccessiblePermit: false, isOversize: false },
  lotId: 'lot-demo',
  entryGateId: 'gate-entree-demo',
  authorizedCents: 2500,
  pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
  cardLast4: '4242',
};

const lockedLotRow = { id: draft.lotId, name: 'Parking Démo', capacity: 40, vehicle_count: 3, hold_quota: 4 };
const openingSessionRow = {
  ...{ id: 'session-1', lot_id: draft.lotId, entry_gate_id: draft.entryGateId, state: 'CREATED', is_within_opening_window: true },
  ...{ number: 'A-1', aisle_code: 'A', level_code: 'P1' },
};

function scriptedEntry(isOnline: boolean): ScriptedSql {
  return new ScriptedSql()
    .answer('lock-lot', [{ ...lockedLotRow, is_online: isOnline }])
    .answer('read-lot-occupancy', [PARKING_DEMO_OCCUPANCY_ROW])
    .answer('read-free-spots', [{ id: 'spot-A-1', number: 'A-1', level_order: 1, aisle_code: 'A', distance_to_exit: 1, needs_check: false, is_ev: false, is_accessible: false, is_oversize: false }])
    .answer('claim-spot', [{ id: 'spot-A-1', number: 'A-1', aisle_code: 'A', level_code: 'P1' }])
    .answer('insert-session', [{ id: 'session-1' }]);
}

function openEntry(scripted: ScriptedSql) {
  return new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 }, () => new Date()).openOrReplay(draft);
}

describe('an entry on a lot the operator put offline after the eligibility check', () => {
  it('refuses a new session as LOT_NOT_IN_SERVICE under the lock, claiming no spot', async () => {
    const scripted = scriptedEntry(false);

    const refusal = await openEntry(scripted).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(EntryRefusedError);
    expect(refusal).toMatchObject({ reason: 'LOT_NOT_IN_SERVICE' });
    expect(scripted.labels()).toEqual(['limit-lock-wait', 'lock-lot', 'read-active-session']);
  });

  it('still gives back the entry already opening at this gate, so a double tap is not refused', async () => {
    const scripted = scriptedEntry(false).answer('read-active-session', [openingSessionRow]);

    expect(await openEntry(scripted)).toEqual({ kind: 'replayed', session: { id: 'session-1', spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' } } });
  });

  it('opens the session as before while the lot is online', async () => {
    const scripted = scriptedEntry(true);

    expect(await openEntry(scripted)).toMatchObject({ kind: 'opened' });
    expect(scripted.count('insert-session')).toBe(1);
  });
});
