import { describe, expect, it } from 'vitest';
import { DashboardRefusedError } from '../../src/domain/dashboard/DashboardRefusedError.ts';
import { findLotOccupancyOfMember } from '../../src/domain/dashboard/findLotOccupancyOfMember.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { julie } from './fakeDriverRepository.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { FakeLevelOccupancyReader, parkingDemoOccupancy } from './fakes/fakeLevelOccupancyReader.ts';
import { FakeLotEquipmentReader } from './fakes/fakeLotEquipmentReader.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';
import { ENTREE_DEMO_ID, SORTIE_DEMO_ID } from '../../src/seed/fixtures/gates.ts';

const NOW = new Date('2026-11-13T19:05:00Z');

function sourcesWith(occupancy = parkingDemoOccupancy) {
  const operators = new FakeOperatorRepository();
  const reader = new FakeLevelOccupancyReader(operators.lots);
  reader.set(PARKING_DEMO_ID, occupancy);
  return { operators, occupancy: reader, equipment: new FakeLotEquipmentReader(operators.lots), clock: () => NOW };
}

describe('reading the occupancy of a lot as a member', () => {
  it('counts occupied, occupied-unknown and entry-confirmed assigned spots against the vehicle counter', async () => {
    const found = await findLotOccupancyOfMember(sourcesWith(), { userId: sophie.id, lotId: PARKING_DEMO_ID });

    expect(found).toEqual({
      lotId: PARKING_DEMO_ID,
      lotName: 'Parking Démo',
      vehicleCount: 7,
      levels: parkingDemoOccupancy.levels,
      occupiedOrAssignedCount: 5,
      counterGap: { kind: 'SPOTS_TO_CHECK', spots: 2 },
      silentGateNames: [],
    });
  });

  it('names the gates silent for more than 2 minutes, never one heard within them or never heard at all', async () => {
    const sources = sourcesWith();
    sources.equipment.stampHeartbeat(ENTREE_DEMO_ID, new Date(NOW.getTime() - 121_000));
    sources.equipment.stampHeartbeat(SORTIE_DEMO_ID, new Date(NOW.getTime() - 120_000));

    const found = await findLotOccupancyOfMember(sources, { userId: sophie.id, lotId: PARKING_DEMO_ID });

    expect(found.silentGateNames).toEqual(['Entrée Démo']);
  });

  it('sums only the assigned spots whose entry is confirmed, leaving out what the reader does not count', async () => {
    const unconfirmed = { ...parkingDemoOccupancy, confirmedAssignedCount: 0 };

    const found = await findLotOccupancyOfMember(sourcesWith(unconfirmed), { userId: sophie.id, lotId: PARKING_DEMO_ID });

    expect(found.occupiedOrAssignedCount).toBe(4);
    expect(found.counterGap).toEqual({ kind: 'SPOTS_TO_CHECK', spots: 3 });
  });

  it('flags a counter below the places taken', async () => {
    const found = await findLotOccupancyOfMember(sourcesWith({ ...parkingDemoOccupancy, vehicleCount: 3 }), { userId: sophie.id, lotId: PARKING_DEMO_ID });

    expect(found.counterGap).toEqual({ kind: 'COUNTER_BELOW', spots: 2 });
  });

  it.each([
    ['another operator', pierre.id, PARKING_DEMO_ID],
    ['a lot that does not exist', sophie.id, '00000000-0000-4000-8000-000000000999'],
    ['a user with no operator', julie.id, PARKING_DEMO_ID],
  ])('refuses %s as LOT_NOT_FOUND', async (_case, userId, lotId) => {
    await expect(findLotOccupancyOfMember(sourcesWith(), { userId, lotId })).rejects.toEqual(new DashboardRefusedError('LOT_NOT_FOUND'));
  });
});
