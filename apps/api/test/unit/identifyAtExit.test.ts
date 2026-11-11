import { describe, expect, it } from 'vitest';
import { identifyAtExit, type IdentifyRequest } from '../../src/domain/exits/identifyAtExit.ts';
import type { AuthenticatedGate } from '../../src/domain/gates/AuthenticatedGate.ts';
import { PassageRefusedError } from '../../src/domain/gates/PassageRefusedError.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';
import { FakeExits, julieInside, type ReadKeys } from './fakes/fakeExits.ts';
import { entreeDemo, sortieDemo } from './fakes/gateFixtures.ts';

const enteredAt = new Date(2026, 10, 4, 18, 2);
const at2117 = new Date(2026, 10, 4, 21, 17);
const transponderGate: AuthenticatedGate = { ...sortieDemo, exitIdKind: 'RFID' };
const julieKeys: ReadKeys = { plateKey: 'ABC123', transponderKey: 'T0042' };

function setup(gate: AuthenticatedGate = sortieDemo) {
  const exits = new FakeExits();
  const payments = new FakePaymentAuthorizer();
  const julie = julieInside(enteredAt);
  exits.add('driver-julie', { ...julie, lotId: gate.lotId }, julieKeys);
  const identify = (identifier: string, overrides: Partial<IdentifyRequest> = {}) =>
    identifyAtExit({ exits, payments }, { gate, requestedGateId: gate.id, identifier, now: at2117, ...overrides });
  return { exits, payments, identify };
}

describe('identifyAtExit', () => {
  it('captures, opens the exit gate and identifies by plate when "abc123" is read, case and spaces ignored', async () => {
    const { exits, payments, identify } = setup();

    const result = await identify('abc123');

    expect(result).toEqual({ outcome: 'opened', identification: 'plate' });
    expect(payments.captured).toMatchObject([{ paymentIntentId: 'pi_julie', amountCents: 975 }]);
    expect(exits.closings).toMatchObject([{ exitGateId: sortieDemo.id, identification: 'PLATE', exit: { exitedAt: at2117, capturedCents: 975 } }]);
  });

  it('reads "A b-C 1 23" as the same plate', async () => {
    const { payments, identify } = setup();

    expect(await identify('a bc 123')).toEqual({ outcome: 'opened', identification: 'plate' });
    expect(payments.captured).toHaveLength(1);
  });

  it('identifies by transponder at a transponder gate', async () => {
    const { exits, identify } = setup(transponderGate);

    const result = await identify('t-0042');

    expect(result).toEqual({ outcome: 'opened', identification: 'transponder' });
    expect(exits.closings).toMatchObject([{ identification: 'TRANSPONDER' }]);
  });

  it('opens the gate that read the vehicle, not another exit gate of the lot', async () => {
    const { exits, identify } = setup();

    await identify('ABC123');

    expect(exits.closings[0]?.exitGateId).toBe(sortieDemo.id);
  });

  it('captures nothing and opens nothing for a plate with no open session', async () => {
    const { exits, payments, identify } = setup();

    const result = await identify('ZZZ 999');

    expect(result).toEqual({ outcome: 'fallback' });
    expect(payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('captures nothing and opens nothing when the same plate is on two open sessions', async () => {
    const { exits, payments, identify } = setup();
    exits.add('driver-marc', { ...julieInside(enteredAt), id: 'session-marc', lotId: sortieDemo.lotId }, julieKeys);

    const result = await identify('ABC 123');

    expect(result).toEqual({ outcome: 'fallback' });
    expect(payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('does not use a session of another lot', async () => {
    const { exits, payments, identify } = setup({ ...sortieDemo, lotId: 'another-lot' });
    exits.add('driver-julie', { ...julieInside(enteredAt), id: 'session-elsewhere', lotId: sortieDemo.lotId }, { plateKey: 'XYZ789' });

    expect(await identify('XYZ 789')).toEqual({ outcome: 'fallback' });
    expect(payments.captured).toEqual([]);
  });

  it('does not read a transponder identifier as a plate, nor the reverse', async () => {
    const plateReader = setup();
    const transponderReader = setup(transponderGate);

    expect(await plateReader.identify('T-0042')).toEqual({ outcome: 'fallback' });
    expect(await transponderReader.identify('ABC 123')).toEqual({ outcome: 'fallback' });
    expect(plateReader.payments.captured).toEqual([]);
    expect(transponderReader.payments.captured).toEqual([]);
  });

  it('captures once when the same plate is read twice', async () => {
    const { payments, exits, identify } = setup();

    const first = await identify('ABC123');
    const second = await identify('ABC123');

    expect(first).toEqual({ outcome: 'opened', identification: 'plate' });
    expect(second).toEqual({ outcome: 'fallback' });
    expect(payments.captured).toHaveLength(1);
    expect(exits.closings).toHaveLength(1);
  });

  it('opens with the capture pending, still identified by plate, when Stripe cannot capture', async () => {
    const { exits, payments, identify } = setup();
    payments.captureOutcome = 'failed';

    const result = await identify('ABC123');

    expect(result).toEqual({ outcome: 'opened', identification: 'plate' });
    expect(exits.pendingClosings).toMatchObject([{ identification: 'PLATE', pendingCaptureCents: 975 }]);
  });

  it('refuses a gate without a reader, and an entry gate, before looking for a session', async () => {
    const noReader = setup({ ...sortieDemo, exitIdKind: 'NONE' });
    const entry = setup(entreeDemo);

    await expect(noReader.identify('ABC123')).rejects.toMatchObject({ reason: 'GATE_WITHOUT_READER' });
    await expect(entry.identify('ABC123')).rejects.toMatchObject({ reason: 'GATE_WITHOUT_READER' });
    expect(noReader.payments.captured).toEqual([]);
    expect(entry.payments.captured).toEqual([]);
  });

  it('refuses a request that names another gate than the one of the device key', async () => {
    const { payments, identify } = setup();

    await expect(identify('ABC123', { requestedGateId: 'another-gate' })).rejects.toBeInstanceOf(PassageRefusedError);
    expect(payments.captured).toEqual([]);
  });

  it('refuses an identifier a reader cannot send, and changes nothing', async () => {
    const { exits, payments, identify } = setup();

    for (const identifier of ['', '   ', '--', "ABC';--", 'ABC_123', 'ABCDEFGHI']) {
      await expect(identify(identifier)).rejects.toMatchObject({ reason: 'IDENTIFIER_INVALID' });
    }
    expect(payments.captured).toEqual([]);
    expect(exits.closings).toEqual([]);
  });

  it('answers payments-unavailable without a payment authorizer, taking nothing', async () => {
    const exits = new FakeExits();
    exits.add('driver-julie', { ...julieInside(enteredAt), lotId: sortieDemo.lotId }, julieKeys);

    const result = await identifyAtExit({ exits, payments: null }, { gate: sortieDemo, requestedGateId: sortieDemo.id, identifier: 'ABC123', now: at2117 });

    expect(result).toEqual({ outcome: 'payments-unavailable' });
    expect(exits.closings).toEqual([]);
  });

  it('answers lot-busy when the lot lock is taken, and does not report an opening', async () => {
    const { exits, identify } = setup();
    exits.busy = true;

    expect(await identify('ABC123')).toEqual({ outcome: 'lot-busy' });
  });
});
