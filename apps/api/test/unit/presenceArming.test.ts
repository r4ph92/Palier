import { describe, expect, it } from 'vitest';
import { createPresenceArming, isArmingEnabled } from '../../src/http/demo/presenceArming.js';

const KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const FIRST = new Date('2026-11-16T14:05:00Z');
const SECOND = new Date('2026-11-16T14:05:03Z');

describe('createPresenceArming', () => {
  it('hands back the arming instant once, then nothing', () => {
    const arming = createPresenceArming();
    arming.arm(KEY, FIRST);

    expect(arming.take(KEY)).toEqual(FIRST);
    expect(arming.take(KEY)).toBeNull();
  });

  it('keeps the latest arming when the loop is armed twice', () => {
    const arming = createPresenceArming();
    arming.arm(KEY, FIRST);
    arming.arm(KEY, SECOND);

    expect(arming.take(KEY)).toEqual(SECOND);
  });

  it('gives nothing to another device key, and forgets the arming for good', () => {
    const arming = createPresenceArming();
    arming.arm(KEY, FIRST);

    expect(arming.take('another-key')).toBeNull();
    expect(arming.take(KEY)).toBeNull();
  });

  it('forgets the arming when cleared', () => {
    const arming = createPresenceArming();
    arming.arm(KEY, FIRST);
    arming.clear();

    expect(arming.take(KEY)).toBeNull();
  });
});

describe('isArmingEnabled', () => {
  const entree = { id: 'gate-501', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' } as const;

  it('needs a key and an online console', () => {
    expect(isArmingEnabled({ deviceKey: '', identity: null, isOffline: false })).toBe(false);
    expect(isArmingEnabled({ deviceKey: KEY, identity: null, isOffline: true })).toBe(false);
    expect(isArmingEnabled({ deviceKey: KEY, identity: null, isOffline: false })).toBe(true);
  });

  it('is for the entry gate only', () => {
    expect(isArmingEnabled({ deviceKey: KEY, identity: entree, isOffline: false })).toBe(true);
    expect(isArmingEnabled({ deviceKey: KEY, identity: { ...entree, kind: 'EXIT' }, isOffline: false })).toBe(false);
  });
});
