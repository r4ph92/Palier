import { describe, expect, it } from 'vitest';
import type { SessionDraft } from '../../src/domain/entries/ParkingSessionRepository.ts';
import { PostgresParkingSessionRepository } from '../../src/infrastructure/postgres/PostgresParkingSessionRepository.ts';
import { PARKING_DEMO_OCCUPANCY_ROW, ScriptedSql, type Rows } from './fakes/scriptedSql.ts';

const draft: SessionDraft = {
  driverId: 'driver-marc',
  now: new Date('2026-11-05T12:00:00Z'),
  vehicleId: 'vehicle-marc',
  plate: 'XYZ 789',
  needs: { isElectric: false, hasAccessiblePermit: false, isOversize: false },
  lotId: 'lot-demo',
  entryGateId: 'gate-entree-demo',
  authorizedCents: 2500,
  pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
  cardLast4: '4242',
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

function scriptedEntry(occupancy: Rows[number]): ScriptedSql {
  return new ScriptedSql()
    .answer('read-lot-occupancy', [occupancy])
    .answer('read-free-spots', [freeSpot])
    .answer('claim-spot', [{ id: 'spot-A-1', number: 'A-1', aisle_code: 'A', level_code: 'P1' }])
    .answer('insert-session', [{ id: 'session-1' }]);
}

async function openEntry(scripted: ScriptedSql) {
  const repository = new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 }, () => new Date());
  return repository.openOrReplay(draft);
}

// #110: the room is read again under the lot lock, where simultaneous scans of the lot wait their turn.
describe('opening an entry when counted vehicles and admitted entries leave no room', () => {
  const lastPlace = { ...PARKING_DEMO_OCCUPANCY_ROW, vehicle_count: 9 };

  it('admits Julie at count 9 of 10 with every spot free', async () => {
    const scripted = scriptedEntry(lastPlace);

    expect(await openEntry(scripted)).toMatchObject({ kind: 'opened' });
  });

  it.each([
    ['Julie was admitted and her loop has not closed', { ...lastPlace, assigned_spot_count: 1 }],
    ['the count is above the capacity', { ...PARKING_DEMO_OCCUPANCY_ROW, vehicle_count: 12 }],
    ['a hold takes the last place', { ...lastPlace, held_spot_count: 1 }],
  ])('refuses Marc without claiming a spot when %s', async (_case, occupancy) => {
    const scripted = new ScriptedSql().answer('read-lot-occupancy', [occupancy]).answer('read-free-spots', [freeSpot]);

    expect(await openEntry(scripted)).toBeNull();
    expect(scripted.count('claim-spot')).toBe(0);
    expect(scripted.insertedSessions).toEqual([]);
  });

  it('reads the room after the lot lock, on the transaction, for the scanned lot', async () => {
    const scripted = scriptedEntry(PARKING_DEMO_OCCUPANCY_ROW);

    await openEntry(scripted);

    const read = scripted.statement('read-lot-occupancy');
    expect(scripted.labels().indexOf('read-lot-occupancy')).toBeGreaterThan(scripted.labels().indexOf('lock-lot'));
    expect(read?.onTransaction).toBe(true);
    expect(read?.params.length).toBeGreaterThan(0);
    expect(read?.params.every((param) => param === draft.lotId)).toBe(true);
  });

  it('refuses when the lot row is gone', async () => {
    const scripted = new ScriptedSql().answer('read-free-spots', [freeSpot]);

    expect(await openEntry(scripted)).toBeNull();
    expect(scripted.count('claim-spot')).toBe(0);
  });
});

describe('PostgresParkingSessionRepository.hasOpeningEntry', () => {
  it('looks only for this driver\'s admitted entry in this lot whose loop has not closed', async () => {
    const scripted = new ScriptedSql();
    const repository = new PostgresParkingSessionRepository(scripted.database(), { withinMilliseconds: 60_000 }, () => new Date());

    expect(await repository.hasOpeningEntry('driver-julie', 'lot-demo')).toBe(false);
    const read = scripted.statements[0];
    expect(read?.text).toMatch(/user_id = \$1 and lot_id = \$2 and state = 'CREATED'/);
    expect(read?.params).toEqual(['driver-julie', 'lot-demo']);
  });
});
