import { describe, expect, it } from 'vitest';
import type { EligibleEntry } from '../../src/domain/entries/EntryEligibility.ts';
import { EntryAdmission } from '../../src/domain/entries/EntryAdmission.ts';
import { UnreachablePaymentAuthorizer } from '../../src/infrastructure/stripe/UnreachablePaymentAuthorizer.ts';
import {
  FakeGateCommander,
  FakeParkingSessionRepository,
  FakePaymentAuthorizer,
  LAVOIE_ACCOUNT,
  silentLog,
  type Journal,
  fakeSessionId,
} from './fakes/entryFakes.ts';
import { entreeDemo } from './fakes/gateFixtures.ts';
import { julie } from './fakeDriverRepository.ts';

const julieAtEntreeDemo: EligibleEntry = {
  driverId: julie.id,
  gate: { id: entreeDemo.id, lotId: entreeDemo.lotId },
  vehicle: { id: 'vehicle-julie', plate: 'ABC 123' },
  payment: { customerId: 'cus_julie', paymentMethodId: 'pm_julie', amountCents: 2500, destinationAccountId: LAVOIE_ACCOUNT },
};

function admissionWith(freeSpots?: readonly string[]) {
  const journal: Journal = [];
  const sessions = new FakeParkingSessionRepository(journal, freeSpots);
  const payments = new FakePaymentAuthorizer(journal);
  const gateCommander = new FakeGateCommander(journal);
  const admission = new EntryAdmission({ sessions, payments, gateCommander });
  return { journal, sessions, payments, gateCommander, admission, log: silentLog() };
}

describe('entry admission', () => {
  it('assigns the spot, then holds the daily cap, then opens the barrier', async () => {
    const { journal, admission, log } = admissionWith();

    const response = await admission.admit(julieAtEntreeDemo, log);

    expect(response).toEqual({ sessionId: fakeSessionId(1), spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' }, barrierOpened: true });
    expect(journal).toEqual(['open-session', 'authorize', 'attach-intent', 'open-gate']);
  });

  it('creates the session from the eligible entry and holds the cap toward the operator', async () => {
    const { sessions, payments, gateCommander, admission, log } = admissionWith();

    await admission.admit(julieAtEntreeDemo, log);

    expect(sessions.drafts).toEqual([
      { driverId: julie.id, vehicleId: 'vehicle-julie', plate: 'ABC 123', lotId: entreeDemo.lotId, entryGateId: entreeDemo.id, authorizedCents: 2500 },
    ]);
    expect(payments.authorized).toEqual([
      { sessionId: fakeSessionId(1), customerId: 'cus_julie', paymentMethodId: 'pm_julie', amountCents: 2500, destinationAccountId: LAVOIE_ACCOUNT },
    ]);
    expect(sessions.paymentIntents.get(fakeSessionId(1))).toBe(`pi_${fakeSessionId(1)}`);
    expect(gateCommander.opened).toEqual([{ gateId: entreeDemo.id, lotId: entreeDemo.lotId, sessionId: fakeSessionId(1) }]);
  });

  it('refuses LOT_FULL without touching the card or the barrier when no spot is free', async () => {
    const { journal, admission, log } = admissionWith([]);

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'LOT_FULL' });
    expect(journal).toEqual(['open-session']);
  });

  it('frees the spot and opens nothing when the card is declined', async () => {
    const { journal, sessions, payments, admission, log } = admissionWith();
    payments.refusal = 'CARD_DECLINED';

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'CARD_DECLINED' });
    expect(journal).toEqual(['open-session', 'authorize', 'cancel-session']);
    expect(sessions.freeSpots[0]).toBe('A-1');
    expect(log.warnings).toHaveLength(1);
  });

  it('frees the spot, closes the session and opens nothing when Stripe is unreachable', async () => {
    const journal: Journal = [];
    const sessions = new FakeParkingSessionRepository(journal);
    const gateCommander = new FakeGateCommander(journal);
    const admission = new EntryAdmission({ sessions, payments: new UnreachablePaymentAuthorizer(), gateCommander });

    await expect(admission.admit(julieAtEntreeDemo, silentLog())).rejects.toMatchObject({ reason: 'PAYMENTS_UNAVAILABLE' });
    expect(journal).toEqual(['open-session', 'cancel-session']);
    expect(gateCommander.opened).toEqual([]);
    expect(sessions.freeSpots[0]).toBe('A-1');
  });

  it('frees the spot, then cancels the hold when the barrier command fails', async () => {
    const { journal, sessions, payments, gateCommander, admission, log } = admissionWith();
    gateCommander.fails = true;

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toThrow('gate_command insert failed');
    expect(journal).toEqual(['open-session', 'authorize', 'attach-intent', 'open-gate', 'cancel-session', 'cancel-intent']);
    expect(payments.cancelled).toEqual([`pi_${fakeSessionId(1)}`]);
    expect(sessions.freeSpots[0]).toBe('A-1');
  });

  it('keeps the barrier error and logs a hold Stripe would not cancel', async () => {
    const { payments, gateCommander, admission, log } = admissionWith();
    gateCommander.fails = true;
    payments.cancelFails = true;

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toThrow('gate_command insert failed');
    expect(log.errors).toHaveLength(2);
  });

  it('still cancels the hold and keeps the barrier error when the spot cannot be freed', async () => {
    const { journal, sessions, payments, gateCommander, admission, log } = admissionWith();
    gateCommander.fails = true;
    sessions.cancelFails = true;

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toThrow('gate_command insert failed');
    expect(journal).toEqual(['open-session', 'authorize', 'attach-intent', 'open-gate', 'cancel-session', 'cancel-intent']);
    expect(payments.cancelled).toEqual([`pi_${fakeSessionId(1)}`]);
    expect(log.errors).toHaveLength(2);
  });

  it('keeps the card refusal when the spot cannot be freed', async () => {
    const { sessions, payments, admission, log } = admissionWith();
    payments.refusal = 'CARD_DECLINED';
    sessions.cancelFails = true;

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'CARD_DECLINED' });
    expect(log.errors).toHaveLength(1);
  });

  it('warns that the hold stays on the platform when the operator has no Stripe account', async () => {
    const { admission, log } = admissionWith();
    const demoEntry = { ...julieAtEntreeDemo, payment: { ...julieAtEntreeDemo.payment, destinationAccountId: null } };

    await admission.admit(demoEntry, log);

    expect(log.warnings).toHaveLength(1);
  });
});
