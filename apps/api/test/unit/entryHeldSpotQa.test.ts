import { describe, expect, it } from 'vitest';
import type { SessionDraft } from '../../src/domain/entries/ParkingSessionRepository.ts';
import { EntryRefusedError } from '../../src/domain/entries/EntryRefusedError.ts';
import type { VehicleNeeds } from '../../src/domain/vehicles/VehicleRepository.ts';
import { PostgresEntryGateRepository } from '../../src/infrastructure/postgres/PostgresEntryGateRepository.ts';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { markSpotHoldsExpired } from '../../src/infrastructure/postgres/spotExpiry.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const NOW = new Date('2026-11-05T12:00:00Z');
const standardNeeds: VehicleNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };
const oversizeNeeds: VehicleNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: true };

function draftWith(needs: VehicleNeeds): SessionDraft {
  return {
    driverId: 'driver-julie',
    vehicleId: 'vehicle-julie',
    plate: 'ABC 123',
    needs,
    lotId: 'lot-demo',
    entryGateId: 'gate-entree-demo',
    authorizedCents: 2500,
    pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
  };
}

// The standard spot A-1 her hold kept, and the oversize spot B-4 still free in the lot.
const heldStandardSpot = { id: 'spot-A-1', number: 'A-1', aisle_code: 'A', level_code: 'P1', is_ev: false, is_accessible: false, is_oversize: false };
const freeOversizeSpot = {
  id: 'spot-B-4',
  number: 'B-4',
  level_order: 1,
  aisle_code: 'B',
  distance_to_exit: 4,
  needs_check: false,
  is_ev: false,
  is_accessible: false,
  is_oversize: true,
};

function openEntry(scripted: ScriptedSql, draft: SessionDraft) {
  const repository = new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 }, () => NOW);
  return repository.openOrReplay(draft);
}

describe('QA #9: the held spot at the entry, under the lot lock', () => {
  it('never seats an oversize vehicle in the standard spot its driver held before switching vehicles', async () => {
    const scripted = new ScriptedSql()
      .answer('use-spot-hold', [{ spot_id: 'spot-A-1' }])
      .answer('assign-held-spot', [heldStandardSpot])
      .answer('read-free-spots', [freeOversizeSpot])
      .answer('claim-spot', [{ id: 'spot-B-4', number: 'B-4', aisle_code: 'B', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-1' }]);

    const opening = await openEntry(scripted, draftWith(oversizeNeeds)).catch(() => null);

    const holdStatements = scripted.statements.filter(({ label }) => label === 'use-spot-hold' || label === 'assign-held-spot');
    const holdUseChecksTheVehicle = holdStatements.some(({ text }) => /is_oversize|is_ev|is_accessible/.test(text));
    const seatedInHeldStandardSpot = opening?.session.spot.number === 'A-1';
    expect(holdUseChecksTheVehicle || !seatedInHeldStandardSpot).toBe(true);
  });

  it('never uses a hold when the driver already has an entry elsewhere', async () => {
    const otherLotSession = {
      id: 'session-0',
      lot_id: 'lot-test-paliers',
      entry_gate_id: 'gate-entree-test-paliers',
      state: 'CREATED',
      is_within_opening_window: true,
      number: 'A-2',
      aisle_code: 'A',
      level_code: 'P1',
    };
    const scripted = new ScriptedSql().answer('read-active-session', [otherLotSession]);

    const refusal = await openEntry(scripted, draftWith(standardNeeds)).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(EntryRefusedError);
    expect((refusal as EntryRefusedError).reason).toBe('ALREADY_INSIDE');
    expect(scripted.count('use-spot-hold')).toBe(0);
  });

  it('uses the hold only after the lot is locked, so the expiry job and a release wait for it', async () => {
    const scripted = new ScriptedSql()
      .answer('use-spot-hold', [{ spot_id: 'spot-A-1' }])
      .answer('assign-held-spot', [heldStandardSpot])
      .answer('insert-session', [{ id: 'session-1' }]);

    await openEntry(scripted, draftWith(standardNeeds));

    const labels = scripted.labels();
    expect(labels.indexOf('lock-lot')).toBeLessThan(labels.indexOf('use-spot-hold'));
    expect(scripted.statements.filter(({ label }) => label === 'use-spot-hold' || label === 'assign-held-spot').every(({ onTransaction }) => onTransaction)).toBe(true);
  });

  it('at the instant a hold ends, entry and the expiry job agree: the job ends it, the entry cannot use it', async () => {
    const entry = new ScriptedSql();
    await openEntry(entry, draftWith(standardNeeds));
    const expiry = new ScriptedSql();
    await markSpotHoldsExpired(expiry.executor(), 'lot-demo', NOW);

    const useText = entry.statements.find(({ label }) => label === 'use-spot-hold')?.text ?? '';
    const expireText = expiry.statements.find(({ label }) => label === 'expire-spot-holds')?.text ?? '';
    expect(useText).toMatch(/expires_at > \$\d+::timestamptz/);
    expect(expireText).toMatch(/expires_at <= \$\d+::timestamptz/);
    expect(entry.statements.find(({ label }) => label === 'use-spot-hold')?.params).toContain(NOW.toISOString());
    expect(expiry.statements.find(({ label }) => label === 'expire-spot-holds')?.params).toContain(NOW.toISOString());
  });
});

describe('QA #9: the eligibility query for a driver holding room in a full lot', () => {
  it('asks only for this driver’s active hold in the scanned lot, still running at the API clock instant', async () => {
    const scripted = new ScriptedSql();
    const gates = new PostgresEntryGateRepository(scripted.database());

    const holdsRoom = await gates.holdsRoomIn({ driverId: 'driver-julie', lotId: 'lot-demo', now: NOW });

    const [statement] = scripted.statements;
    expect(holdsRoom).toBe(false);
    expect(statement?.text).toMatch(/from spot_hold where user_id = \$1 and lot_id = \$2 and status = 'ACTIVE' and expires_at > \$3::timestamptz/);
    expect(statement?.params).toEqual(['driver-julie', 'lot-demo', NOW.toISOString()]);
  });
});
