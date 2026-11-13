import { describe, expect, it } from 'vitest';
import { DashboardRefusedError } from '../../src/domain/dashboard/DashboardRefusedError.ts';
import { findLotOccupancyOfMember } from '../../src/domain/dashboard/findLotOccupancyOfMember.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { julie } from './fakeDriverRepository.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { FakeLevelOccupancyReader, parkingDemoOccupancy } from './fakes/fakeLevelOccupancyReader.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';

function sourcesWith(occupancy = parkingDemoOccupancy) {
  const operators = new FakeOperatorRepository();
  const reader = new FakeLevelOccupancyReader(operators.lots);
  reader.set(PARKING_DEMO_ID, occupancy);
  return { operators, occupancy: reader };
}

describe('reading the occupancy of a lot as a member', () => {
  it('counts occupied, occupied-unknown and entry-confirmed assigned spots against the vehicle counter', async () => {
    const found = await findLotOccupancyOfMember(sourcesWith(), sophie.id, PARKING_DEMO_ID);

    expect(found).toEqual({
      lotId: PARKING_DEMO_ID,
      lotName: 'Parking Démo',
      vehicleCount: 7,
      levels: parkingDemoOccupancy.levels,
      occupiedOrAssignedCount: 5,
      counterGap: { kind: 'SPOTS_TO_CHECK', spots: 2 },
    });
  });

  it('leaves out an assigned spot whose entry is not confirmed, and a held one', async () => {
    const unconfirmed = { ...parkingDemoOccupancy, confirmedAssignedCount: 0 };

    const found = await findLotOccupancyOfMember(sourcesWith(unconfirmed), sophie.id, PARKING_DEMO_ID);

    expect(found.occupiedOrAssignedCount).toBe(4);
    expect(found.counterGap).toEqual({ kind: 'SPOTS_TO_CHECK', spots: 3 });
  });

  it('flags a counter below the places taken', async () => {
    const found = await findLotOccupancyOfMember(sourcesWith({ ...parkingDemoOccupancy, vehicleCount: 3 }), sophie.id, PARKING_DEMO_ID);

    expect(found.counterGap).toEqual({ kind: 'COUNTER_BELOW', spots: 2 });
  });

  it.each([
    ['another operator', pierre.id, PARKING_DEMO_ID],
    ['a lot that does not exist', sophie.id, '00000000-0000-4000-8000-000000000999'],
    ['a user with no operator', julie.id, PARKING_DEMO_ID],
  ])('refuses %s as LOT_NOT_FOUND', async (_case, userId, lotId) => {
    await expect(findLotOccupancyOfMember(sourcesWith(), userId, lotId)).rejects.toEqual(new DashboardRefusedError('LOT_NOT_FOUND'));
  });
});
