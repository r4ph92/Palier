import { describe, expect, it, vi } from 'vitest';
import { decideRepeatedScan, openingFor, type ActiveSessionFacts } from '../../src/domain/entries/decideRepeatedScan.ts';

const entreeDemo = { lotId: 'lot-demo', entryGateId: 'gate-entree-demo' };

const openingAtEntreeDemo: ActiveSessionFacts = {
  id: 'session-1',
  ...entreeDemo,
  state: 'CREATED',
  isWithinOpeningWindow: true,
  spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' },
};

describe('decideRepeatedScan', () => {
  it('opens a new entry when the driver has no active session (none, or only cancelled ones)', () => {
    expect(decideRepeatedScan(null, entreeDemo)).toEqual({ kind: 'open' });
  });

  it('replays the same entry when the driver scans the same gate while it is still opening', () => {
    expect(decideRepeatedScan(openingAtEntreeDemo, entreeDemo)).toEqual({
      kind: 'replay',
      session: { id: 'session-1', spot: { number: 'A-1', levelCode: 'P1', aisleCode: 'A' } },
    });
  });

  it.each<[string, ActiveSessionFacts, { lotId: string; entryGateId: string }]>([
    ['another entry gate of the same lot', openingAtEntreeDemo, { ...entreeDemo, entryGateId: 'gate-entree-2' }],
    ['the entry gate of another lot', openingAtEntreeDemo, { lotId: 'lot-roy', entryGateId: 'gate-entree-roy' }],
    ['an entry the loop already confirmed', { ...openingAtEntreeDemo, state: 'ENTRY_CONFIRMED' }, entreeDemo],
    ['a spot presumed taken once the driver walked away (story #18)', { ...openingAtEntreeDemo, state: 'PARKED_PRESUMED' }, entreeDemo],
    ['an entry past its opening window', { ...openingAtEntreeDemo, isWithinOpeningWindow: false }, entreeDemo],
  ])('refuses a scan of %s', (_case, active, scan) => {
    expect(decideRepeatedScan(active, scan)).toEqual({ kind: 'refuse' });
  });
});

describe('openingFor', () => {
  const spot = { number: 'A-1', levelCode: 'P1', aisleCode: 'A' };

  it('hands the replayed session back without opening a new one', async () => {
    const openNew = vi.fn();

    expect(await openingFor({ decision: { kind: 'replay', session: { id: 'session-1', spot } }, isLotOnline: true }, openNew)).toEqual({
      kind: 'replayed',
      session: { id: 'session-1', spot },
    });
    expect(openNew).not.toHaveBeenCalled();
  });

  it('refuses ALREADY_INSIDE without opening a new session', async () => {
    const openNew = vi.fn();

    await expect(openingFor({ decision: { kind: 'refuse' }, isLotOnline: true }, openNew)).rejects.toMatchObject({ reason: 'ALREADY_INSIDE' });
    expect(openNew).not.toHaveBeenCalled();
  });

  it('opens a new session, or answers null when no spot is free', async () => {
    expect(await openingFor({ decision: { kind: 'open' }, isLotOnline: true }, () => Promise.resolve({ id: 'session-2', spot }))).toEqual({ kind: 'opened', session: { id: 'session-2', spot } });
    expect(await openingFor({ decision: { kind: 'open' }, isLotOnline: true }, () => Promise.resolve(null))).toBeNull();
  });

  it('still hands back the entry already opening on a lot put offline since it was admitted', async () => {
    const openNew = vi.fn();

    expect(await openingFor({ decision: { kind: 'replay', session: { id: 'session-1', spot } }, isLotOnline: false }, openNew)).toEqual({
      kind: 'replayed',
      session: { id: 'session-1', spot },
    });
    expect(openNew).not.toHaveBeenCalled();
  });

  it('refuses a new session on a lot put offline as LOT_NOT_IN_SERVICE, without opening one', async () => {
    const openNew = vi.fn();

    await expect(openingFor({ decision: { kind: 'open' }, isLotOnline: false }, openNew)).rejects.toMatchObject({ reason: 'LOT_NOT_IN_SERVICE' });
    expect(openNew).not.toHaveBeenCalled();
  });
});
