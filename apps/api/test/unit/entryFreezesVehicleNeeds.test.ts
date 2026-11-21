import { describe, expect, it } from 'vitest';
import type { SessionDraft } from '../../src/domain/entries/ParkingSessionRepository.ts';
import type { VehicleNeeds } from '../../src/domain/vehicles/VehicleRepository.ts';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PARKING_DEMO_OCCUPANCY_ROW, ScriptedSql } from './fakes/scriptedSql.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
const WINDOW = { withinMilliseconds: 60_000 };
const standard: VehicleNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };
const electricWithPermit: VehicleNeeds = { isElectric: true, hasAccessiblePermit: true, isOversize: false };

function draftWith(needs: VehicleNeeds): SessionDraft {
  return {
    driverId: 'driver-marc',
    now: NOW,
    vehicleId: 'vehicle-marc',
    plate: 'XYZ 789',
    needs,
    lotId: 'lot-demo',
    entryGateId: 'gate-entree-demo',
    authorizedCents: 2500,
    pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
    cardLast4: '4242',
  };
}

const freeEvSpot = { id: 'spot-A-5', number: 'A-5', level_order: 1, aisle_code: 'A', distance_to_exit: 5, needs_check: false, is_ev: true, is_accessible: false, is_oversize: false };
const freeStandardSpot = { id: 'spot-A-1', number: 'A-1', level_order: 1, aisle_code: 'A', distance_to_exit: 1, needs_check: false, is_ev: false, is_accessible: false, is_oversize: false };

async function enter(scripted: ScriptedSql, needs: VehicleNeeds) {
  await new PostgresParkingSessionRepository(scripted.database(), WINDOW, () => NOW).openOrReplay(draftWith(needs));
}

describe('#219: the entry writes the needs the spot was chosen with on the session', () => {
  it('records an electric vehicle with a permit as such, with the spot those needs chose', async () => {
    const scripted = new ScriptedSql()
      .answer('read-lot-occupancy', [PARKING_DEMO_OCCUPANCY_ROW])
      .answer('read-free-spots', [freeEvSpot, freeStandardSpot])
      .answer('claim-spot', [{ id: 'spot-A-5', number: 'A-5', aisle_code: 'A', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-1' }]);

    await enter(scripted, electricWithPermit);

    expect(scripted.insertedSessions).toEqual([expect.objectContaining({ isElectric: true, hasAccessiblePermit: true, isOversize: false })]);
  });

  it('records a standard vehicle as standard', async () => {
    const scripted = new ScriptedSql()
      .answer('read-lot-occupancy', [PARKING_DEMO_OCCUPANCY_ROW])
      .answer('read-free-spots', [freeStandardSpot])
      .answer('claim-spot', [{ id: 'spot-A-1', number: 'A-1', aisle_code: 'A', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-1' }]);

    await enter(scripted, standard);

    expect(scripted.insertedSessions).toEqual([expect.objectContaining({ isElectric: false, hasAccessiblePermit: false, isOversize: false })]);
  });

  it('records the needs on an entry that uses a hold too', async () => {
    const scripted = new ScriptedSql()
      .answer('read-held-spot', [{ hold_id: 'hold-marc', spot_id: 'spot-A-5', is_ev: true, is_accessible: false, is_oversize: false }])
      .answer('use-spot-hold', [{ id: 'hold-marc' }])
      .answer('assign-held-spot', [{ id: 'spot-A-5', number: 'A-5', aisle_code: 'A', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-1' }]);

    await enter(scripted, electricWithPermit);

    expect(scripted.insertedSessions).toEqual([expect.objectContaining({ consumedSpotHoldId: 'hold-marc', isElectric: true, hasAccessiblePermit: true })]);
  });

  it('gives each new entry the needs of the vehicle at that entry, so a car made electric since enters as electric', async () => {
    const before = new ScriptedSql()
      .answer('read-lot-occupancy', [PARKING_DEMO_OCCUPANCY_ROW])
      .answer('read-free-spots', [freeStandardSpot])
      .answer('claim-spot', [{ id: 'spot-A-1', number: 'A-1', aisle_code: 'A', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-1' }]);
    const after = new ScriptedSql()
      .answer('read-lot-occupancy', [PARKING_DEMO_OCCUPANCY_ROW])
      .answer('read-free-spots', [freeEvSpot, freeStandardSpot])
      .answer('claim-spot', [{ id: 'spot-A-5', number: 'A-5', aisle_code: 'A', level_code: 'P1' }])
      .answer('insert-session', [{ id: 'session-2' }]);

    await enter(before, standard);
    await enter(after, { ...standard, isElectric: true });

    expect(before.insertedSessions).toEqual([expect.objectContaining({ isElectric: false })]);
    expect(after.insertedSessions).toEqual([expect.objectContaining({ isElectric: true })]);
  });
});
