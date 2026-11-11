import { randomUUID } from 'node:crypto';
import type { DashboardLot, DashboardOperator, KycStatus } from '@palier/shared-types';
import type { NewOperator, OperatorRepository } from '../../../src/domain/dashboard/OperatorRepository.ts';
import { PIERRE_ROY_ID, SOPHIE_LAVOIE_ID } from '../../../src/config/testPersonas.ts';
import { LAVOIE_OPERATOR_ID, ROY_OPERATOR_ID } from '../../../src/seed/fixtures/operators.ts';
import { FakeLotStore, parkingDemoDetails, parkingTestPaliersDetails } from './fakeLotSetupRepository.ts';

export const lavoie: DashboardOperator = { id: LAVOIE_OPERATOR_ID, legalName: 'Stationnements Lavoie inc.', kycStatus: 'VERIFIED' };
export const roy: DashboardOperator = { id: ROY_OPERATOR_ID, legalName: 'Garages Roy', kycStatus: 'NOT_STARTED' };
export const parkingDemo: DashboardLot = { id: parkingDemoDetails.id, name: parkingDemoDetails.name, isOnline: parkingDemoDetails.isOnline };
export const parkingTestPaliers: DashboardLot = { id: parkingTestPaliersDetails.id, name: parkingTestPaliersDetails.name, isOnline: parkingTestPaliersDetails.isOnline };

// Seeded like the database: Sophie belongs to Lavoie, Pierre to Roy, and nobody else to anything.
export class FakeOperatorRepository implements OperatorRepository {
  readonly lots: FakeLotStore;
  readonly #operators = new Map<string, DashboardOperator>([[lavoie.id, lavoie], [roy.id, roy]]);
  readonly #memberships = new Map<string, string>([[SOPHIE_LAVOIE_ID, LAVOIE_OPERATOR_ID], [PIERRE_ROY_ID, ROY_OPERATOR_ID]]);

  constructor(lots: FakeLotStore = new FakeLotStore()) {
    this.lots = lots;
  }

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
    return Promise.resolve(this.lots.lotsOf(operatorId));
  }
}
