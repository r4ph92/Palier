import { describe, expect, it } from 'vitest';
import { authenticateDeviceKey } from '../../src/domain/gates/authenticateDeviceKey.ts';
import { hashDeviceKey } from '../../src/domain/gates/hashDeviceKey.ts';
import { PassageRefusedError } from '../../src/domain/gates/PassageRefusedError.ts';
import { recordPassage, type PassageCommand } from '../../src/domain/gates/recordPassage.ts';
import {
  ENTREE_DEMO_KEY,
  entreeDemo,
  FakeGateDeviceKeyRepository,
  FakePassageLedger,
  REVOKED_KEY,
  sortieDemo,
  UNKNOWN_KEY,
} from './fakes/gateFixtures.ts';

const now = new Date('2026-10-27T22:02:00Z');
const clock = () => now;

function entryAt(closedAt: Date): PassageCommand {
  return { gate: entreeDemo, requestedGateId: entreeDemo.id, closedAt };
}

describe('hashDeviceKey', () => {
  it('stores the SHA-256 of the key in hexadecimal', () => {
    expect(hashDeviceKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('authenticateDeviceKey', () => {
  const repository = new FakeGateDeviceKeyRepository();

  it('finds the gate of an active key', async () => {
    expect(await authenticateDeviceKey(ENTREE_DEMO_KEY, repository)).toEqual(entreeDemo);
  });

  it('refuses an unknown key', async () => {
    expect(await authenticateDeviceKey(UNKNOWN_KEY, repository)).toBeUndefined();
  });

  it('refuses a revoked key', async () => {
    expect(await authenticateDeviceKey(REVOKED_KEY, repository)).toBeUndefined();
  });
});

describe('recordPassage', () => {
  it('counts one more vehicle at an entry gate', async () => {
    const ledger = new FakePassageLedger(0);

    const passage = await recordPassage(entryAt(now), { ledger, clock });

    expect(ledger.entries).toEqual([{ gate: entreeDemo, closedAt: now, vehicleCountChange: 1 }]);
    expect(passage).toEqual({
      gateId: entreeDemo.id,
      lotId: entreeDemo.lotId,
      kind: 'ENTRY',
      closedAt: '2026-10-27T22:02:00.000Z',
      vehicleCount: 1,
    });
  });

  it('counts one vehicle less at an exit gate', async () => {
    const ledger = new FakePassageLedger(1);
    const command = { gate: sortieDemo, requestedGateId: sortieDemo.id, closedAt: now };

    const passage = await recordPassage(command, { ledger, clock });

    expect(ledger.entries[0]?.vehicleCountChange).toBe(-1);
    expect(passage.vehicleCount).toBe(0);
  });

  it('documents that the fake ledger, like Postgres, keeps the count at zero', async () => {
    const ledger = new FakePassageLedger(0);
    const command = { gate: sortieDemo, requestedGateId: sortieDemo.id, closedAt: now };

    expect((await recordPassage(command, { ledger, clock })).vehicleCount).toBe(0);
  });

  it('refuses a passage for another gate than the key’s, without counting', async () => {
    const ledger = new FakePassageLedger(0);
    const command = { gate: entreeDemo, requestedGateId: sortieDemo.id, closedAt: now };

    await expect(recordPassage(command, { ledger, clock })).rejects.toEqual(new PassageRefusedError('GATE_FORBIDDEN'));
    expect(ledger.entries).toEqual([]);
  });

  it('refuses a passage from a gate without loops', async () => {
    const ledger = new FakePassageLedger(0);
    const command = { ...entryAt(now), gate: { ...entreeDemo, hasLoops: false } };

    await expect(recordPassage(command, { ledger, clock })).rejects.toMatchObject({ reason: 'GATE_WITHOUT_LOOPS' });
    expect(ledger.entries).toEqual([]);
  });

  it('refuses a loop closed more than 5 minutes in the future', async () => {
    const ledger = new FakePassageLedger(0);
    const closedAt = new Date(now.getTime() + 5 * 60 * 1000 + 1);

    await expect(recordPassage(entryAt(closedAt), { ledger, clock })).rejects.toMatchObject({ reason: 'CLOSED_AT_IN_FUTURE' });
    expect(ledger.entries).toEqual([]);
  });

  it('accepts a loop closed exactly 5 minutes ahead of the server clock', async () => {
    const ledger = new FakePassageLedger(0);
    const closedAt = new Date(now.getTime() + 5 * 60 * 1000);

    expect((await recordPassage(entryAt(closedAt), { ledger, clock })).vehicleCount).toBe(1);
  });
});
