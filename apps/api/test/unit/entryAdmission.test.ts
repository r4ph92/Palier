import { describe, expect, it } from 'vitest';
import type { EligibleEntry } from '../../src/domain/entries/EntryEligibility.ts';
import { EntryAdmission } from '../../src/domain/entries/EntryAdmission.ts';
import { EntryRefusedError } from '../../src/domain/entries/EntryRefusedError.ts';
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
  now: new Date('2026-11-05T12:00:00Z'),
  gate: { id: entreeDemo.id, lotId: entreeDemo.lotId },
  vehicle: { id: 'vehicle-julie', plate: 'ABC 123', needs: { isElectric: false, hasAccessiblePermit: false, isOversize: false } },
  payment: { customerId: 'cus_julie', paymentMethodId: 'pm_julie', amountCents: 2500, destinationAccountId: LAVOIE_ACCOUNT },
  pricing: { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 },
  cardLast4: '4242',
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

    const admitted = await admission.admit(julieAtEntreeDemo, log);

    expect(admitted).toEqual({
      kind: 'opened',
      response: { sessionId: fakeSessionId(1), spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' }, barrierOpened: true },
    });
    expect(journal).toEqual(['open-session', 'authorize', 'attach-intent', 'open-gate']);
  });

  it('creates the session with the lot pricing in force at entry and holds the cap toward the operator', async () => {
    const { sessions, payments, gateCommander, admission, log } = admissionWith();

    await admission.admit(julieAtEntreeDemo, log);

    expect(sessions.drafts).toEqual([
      { driverId: julie.id, now: julieAtEntreeDemo.now, vehicleId: 'vehicle-julie', plate: 'ABC 123', needs: julieAtEntreeDemo.vehicle.needs, lotId: entreeDemo.lotId, entryGateId: entreeDemo.id, authorizedCents: 2500, pricing: julieAtEntreeDemo.pricing, cardLast4: '4242' },
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

  it('refuses NO_SUITABLE_SPOT without touching the card or the barrier when no free spot fits the vehicle', async () => {
    const { journal, sessions, payments, admission, log } = admissionWith();
    sessions.noSuitableSpot = true;

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'NO_SUITABLE_SPOT' });
    expect(journal).toEqual(['open-session']);
    expect(payments.authorized).toEqual([]);
  });

  it('frees the spot and opens nothing when the card is declined', async () => {
    const { journal, sessions, payments, admission, log } = admissionWith();
    payments.refusal = 'CARD_DECLINED';

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'CARD_DECLINED', authorizedCents: 2500 });
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
    payments.release = 'failed';

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toThrow('gate_command insert failed');
    expect(log.errors).toHaveLength(2);
  });

  it('releases the hold and refuses without opening the barrier when the job cancelled the session meanwhile', async () => {
    const { journal, sessions, payments, gateCommander, admission, log } = admissionWith();
    payments.authorize = async (request) => {
      sessions.cancelIfCreated(request.sessionId);
      return `pi_${request.sessionId}`;
    };

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'PAYMENTS_UNAVAILABLE' });
    expect(journal).toEqual(['open-session', 'attach-intent', 'cancel-intent']);
    expect(gateCommander.opened).toEqual([]);
    expect(payments.cancelled).toEqual([`pi_${fakeSessionId(1)}`]);
    expect(log.warnings).toEqual([[{ sessionId: fakeSessionId(1), paymentIntentId: `pi_${fakeSessionId(1)}` }, 'entry cancelled before its hold was recorded']]);
    expect(log.errors).toEqual([]);
  });

  it('undoes the entry and keeps the error when the hold cannot be recorded on a session neither created nor cancelled', async () => {
    const { journal, sessions, payments, gateCommander, admission, log } = admissionWith();
    payments.authorize = async (request) => {
      sessions.confirmEntry(request.sessionId, new Date('2026-11-04T12:00:00Z'));
      return `pi_${request.sessionId}`;
    };

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toThrow('parking_session hold not recorded');
    expect(journal).toEqual(['open-session', 'attach-intent', 'cancel-session', 'cancel-intent']);
    expect(gateCommander.opened).toEqual([]);
    expect(payments.cancelled).toEqual([`pi_${fakeSessionId(1)}`]);
    expect(log.errors).toHaveLength(1);
  });

  it.each(['failed', 'gone'] as const)('logs a hold release that answers %s', async (release) => {
    const { payments, gateCommander, admission, log } = admissionWith();
    gateCommander.fails = true;
    payments.release = release;

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toThrow('gate_command insert failed');
    expect(log.errors[1]).toEqual([{ paymentIntentId: `pi_${fakeSessionId(1)}`, release }, 'could not cancel the entry hold']);
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

  it('hands a second scan of the same gate the same entry and spot, with one card hold and one barrier opening', async () => {
    const { journal, payments, gateCommander, admission, log } = admissionWith();

    const first = await admission.admit(julieAtEntreeDemo, log);
    const second = await admission.admit(julieAtEntreeDemo, log);

    expect(second).toEqual({ kind: 'replayed', response: first.response });
    expect(payments.authorized).toHaveLength(1);
    expect(gateCommander.opened).toHaveLength(1);
    expect(journal).toEqual(['open-session', 'authorize', 'attach-intent', 'open-gate', 'open-session']);
  });

  it('replays while the first scan still waits on Stripe, and the session ends CANCELLED when that hold then fails', async () => {
    const { sessions, payments, admission, log } = admissionWith();
    let replay: Promise<unknown> = Promise.resolve();
    payments.authorize = (request) => {
      payments.authorized.push(request);
      replay = admission.admit(julieAtEntreeDemo, log);
      return Promise.reject(new EntryRefusedError('CARD_DECLINED'));
    };

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'CARD_DECLINED' });

    await expect(replay).resolves.toMatchObject({ kind: 'replayed', response: { sessionId: fakeSessionId(1), barrierOpened: true } });
    expect(payments.authorized).toHaveLength(1);
    expect((await sessions.findForUser(fakeSessionId(1), julie.id))?.state).toBe('CANCELLED');
  });

  it('refuses ALREADY_INSIDE, without a new hold, once the loop confirmed the first entry', async () => {
    const { sessions, payments, admission, log } = admissionWith();
    await admission.admit(julieAtEntreeDemo, log);
    sessions.confirmEntry(fakeSessionId(1), new Date('2026-11-04T12:00:00Z'));

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'ALREADY_INSIDE' });
    expect(payments.authorized).toHaveLength(1);
  });

  it('refuses ALREADY_INSIDE once the first entry is past its opening window', async () => {
    const { sessions, admission, log } = admissionWith();
    await admission.admit(julieAtEntreeDemo, log);
    sessions.closeOpeningWindow(fakeSessionId(1));

    await expect(admission.admit(julieAtEntreeDemo, log)).rejects.toMatchObject({ reason: 'ALREADY_INSIDE' });
  });

  it('warns that the hold stays on the platform when the operator has no Stripe account', async () => {
    const { admission, log } = admissionWith();
    const demoEntry = { ...julieAtEntreeDemo, payment: { ...julieAtEntreeDemo.payment, destinationAccountId: null } };

    await admission.admit(demoEntry, log);

    expect(log.warnings).toHaveLength(1);
  });
});
