import { randomUUID } from 'node:crypto';
import type { DashboardLot, DashboardOperator, KycStatus } from '@palier/shared-types';
import type { NewOperator, OperatorRepository } from '../../../src/domain/dashboard/OperatorRepository.ts';
import { GARAGE_ROY_ID } from '../../../src/seed/fixtures/garageRoy.ts';
import { PIERRE_ROY_ID, SOPHIE_LAVOIE_ID } from '../../../src/config/testPersonas.ts';
import { LAVOIE_OPERATOR_ID, ROY_OPERATOR_ID } from '../../../src/seed/fixtures/operators.ts';
import { PARKING_DEMO_ID } from '../../../src/seed/fixtures/parkingDemo.ts';
import { PARKING_TEST_PALIERS_ID } from '../../../src/seed/fixtures/parkingTestPaliers.ts';

interface OwnedLot extends DashboardLot {
  readonly operatorId: string;
}

export const lavoie: DashboardOperator = { id: LAVOIE_OPERATOR_ID, legalName: 'Stationnements Lavoie inc.', kycStatus: 'VERIFIED' };
export const roy: DashboardOperator = { id: ROY_OPERATOR_ID, legalName: 'Garages Roy', kycStatus: 'NOT_STARTED' };
export const parkingDemo: DashboardLot = { id: PARKING_DEMO_ID, name: 'Parking Démo', isOnline: true };
export const parkingTestPaliers: DashboardLot = { id: PARKING_TEST_PALIERS_ID, name: 'Parking Test Paliers', isOnline: false };

const seededLots: readonly OwnedLot[] = [
  { ...parkingDemo, operatorId: LAVOIE_OPERATOR_ID },
  { ...parkingTestPaliers, operatorId: LAVOIE_OPERATOR_ID },
  { id: GARAGE_ROY_ID, name: 'Garage Roy', isOnline: false, operatorId: ROY_OPERATOR_ID },
];

// Seeded like the database: Sophie belongs to Lavoie, Pierre to Roy, and nobody else to anything.
export class FakeOperatorRepository implements OperatorRepository {
  readonly #operators = new Map<string, DashboardOperator>([[lavoie.id, lavoie], [roy.id, roy]]);
  readonly #memberships = new Map<string, string>([[SOPHIE_LAVOIE_ID, LAVOIE_OPERATOR_ID], [PIERRE_ROY_ID, ROY_OPERATOR_ID]]);

  findOperatorOfMember(userId: string): Promise<DashboardOperator | null> {
    const operatorId = this.#memberships.get(userId);
    return Promise.resolve(operatorId === undefined ? null : (this.#operators.get(operatorId) ?? null));
  }

  createOperatorWithMember({ userId, legalName }: NewOperator): Promise<DashboardOperator | null> {
    if (this.#memberships.has(userId)) {
      return Promise.resolve(null);
    }
    const created: DashboardOperator = { id: randomUUID(), legalName, kycStatus: 'NOT_STARTED' };
    this.#operators.set(created.id, created);
    this.#memberships.set(userId, created.id);
    return Promise.resolve(created);
  }

  setKycStatus(operatorId: string, kycStatus: KycStatus): void {
    const found = this.#operators.get(operatorId);
    if (found !== undefined) {
      this.#operators.set(operatorId, { ...found, kycStatus });
    }
  }

  listLotsOfOperator(operatorId: string): Promise<readonly DashboardLot[]> {
    return Promise.resolve(seededLots.filter((lot) => lot.operatorId === operatorId).map(withoutOwner));
  }

  findLotOfOperator(operatorId: string, lotId: string): Promise<DashboardLot | null> {
    const lot = seededLots.find((candidate) => candidate.id === lotId && candidate.operatorId === operatorId);
    return Promise.resolve(lot === undefined ? null : withoutOwner(lot));
  }
}

function withoutOwner({ id, name, isOnline }: OwnedLot): DashboardLot {
  return { id, name, isOnline };
}
