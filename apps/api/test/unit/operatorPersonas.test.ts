import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_TEST_USER_IDS,
  JULIE_TREMBLAY_ID,
  NOUVEL_OPERATEUR_ID,
  OPERATOR_PERSONA_IDS,
  SOPHIE_LAVOIE_ID,
} from '../../src/config/testPersonas.ts';
import { driverPersonas } from '../../src/seed/fixtures/drivers.ts';
import { operatorMemberFixtures, operatorUserFixtures } from '../../src/seed/fixtures/operatorUsers.ts';
import { LAVOIE_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { parkingTestPaliersLot } from '../../src/seed/fixtures/parkingTestPaliers.ts';

describe('seeded operator personas', () => {
  it('makes Sophie a member of Stationnements Lavoie and leaves Nouvel Opérateur without an operator', () => {
    expect(operatorMemberFixtures).toContainEqual({ userId: SOPHIE_LAVOIE_ID, operatorId: LAVOIE_OPERATOR_ID });
    expect(operatorMemberFixtures.some(({ userId }) => userId === NOUVEL_OPERATEUR_ID)).toBe(false);
  });

  it('never shares an id or an email with a driver persona', () => {
    const users = [...driverPersonas.map(({ user }) => user), ...operatorUserFixtures];

    expect(new Set(users.map(({ id }) => id)).size).toBe(users.length);
    expect(new Set(users.map(({ email }) => email)).size).toBe(users.length);
  });

  it('offers the operator personas and Julie on the dashboard test list', () => {
    expect(DASHBOARD_TEST_USER_IDS).toEqual(expect.arrayContaining([...OPERATOR_PERSONA_IDS, JULIE_TREMBLAY_ID]));
  });

  it('puts Parking Test Paliers under Stationnements Lavoie, offline', () => {
    expect(parkingTestPaliersLot).toMatchObject({ name: 'Parking Test Paliers', operatorId: LAVOIE_OPERATOR_ID, isOnline: false });
  });
});
