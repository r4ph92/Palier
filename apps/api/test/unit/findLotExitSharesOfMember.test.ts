import { describe, expect, it } from 'vitest';
import { DashboardRefusedError } from '../../src/domain/dashboard/DashboardRefusedError.ts';
import { findLotExitSharesOfMember } from '../../src/domain/dashboard/findLotExitSharesOfMember.ts';
import type { RecordedExitCounts } from '../../src/domain/dashboard/ExitIdentificationReader.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { julie } from './fakeDriverRepository.ts';
import { pierre, sophie } from './fakes/dashboardFixtures.ts';
import { FakeExitIdentificationReader } from './fakes/fakeExitIdentificationReader.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';

const NOW = new Date('2026-11-16T12:00:00Z');

function sources() {
  const operators = new FakeOperatorRepository();
  const exitIdentifications = new FakeExitIdentificationReader(operators.lots);
  return { operators, exitIdentifications, clock: () => NOW };
}

describe('reading the exit identification shares of a lot as a member', () => {
  it('gives the counts of Parking Démo and their total, with staff at 0', async () => {
    const found = await findLotExitSharesOfMember(sources(), { userId: sophie.id, lotId: PARKING_DEMO_ID });

    expect(found).toEqual({ lotName: 'Parking Démo', totalExits: 10, counts: { BEACON: 5, APP: 3, PLATE: 2, TRANSPONDER: 0, STAFF: 0 } });
  });

  it('asks for the exits of the last 30 days, counted from the clock', async () => {
    const given = sources();

    await findLotExitSharesOfMember(given, { userId: sophie.id, lotId: PARKING_DEMO_ID });

    expect(given.exitIdentifications.lastCutoff).toEqual(new Date('2026-10-17T12:00:00Z'));
  });

  it('reads a lot with no exit as a total of 0', async () => {
    const given = sources();
    given.exitIdentifications.set(PARKING_DEMO_ID, { lotName: 'Parking Démo', counts: { BEACON: 0, APP: 0, PLATE: 0, TRANSPONDER: 0, STAFF: 0 } });

    const found = await findLotExitSharesOfMember(given, { userId: sophie.id, lotId: PARKING_DEMO_ID });

    expect(found.totalExits).toBe(0);
  });

  it('keeps a recorded staff count and includes it in the total', async () => {
    const given = sources();
    const counts: RecordedExitCounts = { BEACON: 5, APP: 3, PLATE: 2, TRANSPONDER: 0, STAFF: 4 };
    given.exitIdentifications.set(PARKING_DEMO_ID, { lotName: 'Parking Démo', counts });

    const found = await findLotExitSharesOfMember(given, { userId: sophie.id, lotId: PARKING_DEMO_ID });

    expect(found.counts.STAFF).toBe(4);
    expect(found.totalExits).toBe(14);
  });

  it.each([
    ['another operator', pierre.id, PARKING_DEMO_ID],
    ['a lot that does not exist', sophie.id, '00000000-0000-4000-8000-000000000999'],
    ['a user with no operator', julie.id, PARKING_DEMO_ID],
  ])('refuses %s as LOT_NOT_FOUND', async (_case, userId, lotId) => {
    await expect(findLotExitSharesOfMember(sources(), { userId, lotId })).rejects.toEqual(new DashboardRefusedError('LOT_NOT_FOUND'));
  });
});
