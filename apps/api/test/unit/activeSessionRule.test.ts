import { describe, expect, it } from 'vitest';
import { activeSessionRefusal, activeSessionWarning, decideActiveSessionRule } from '../../src/seed/activeSessionRule.ts';
import type { SpotStateChange } from '../../src/seed/spotStateArguments.ts';

function change(state: SpotStateChange['state'], forceActiveSession = false): SpotStateChange {
  return { lotName: 'Parking Démo', spotNumber: 'B-3', state, forceActiveSession };
}

describe('decideActiveSessionRule', () => {
  it('refuses freeing a spot an active session holds', () => {
    expect(decideActiveSessionRule(change('AVAILABLE'), 1)).toBe('refuse');
  });

  it('frees it with a warning when forced', () => {
    expect(decideActiveSessionRule(change('AVAILABLE', true), 1)).toBe('change-and-warn');
  });

  it('frees a spot with no active session without a flag', () => {
    expect(decideActiveSessionRule(change('AVAILABLE'), 0)).toBe('change');
  });

  it.each(['OCCUPIED', 'OUT_OF_SERVICE'] as const)('sets %s even when an active session holds the spot', (state) => {
    expect(decideActiveSessionRule(change(state), 1)).toBe('change');
  });
});

describe('activeSessionRefusal', () => {
  it('names the spot and says an active session holds it', () => {
    expect(activeSessionRefusal(change('AVAILABLE'))).toMatch(/B-3.*held by an active session/);
  });
});

describe('activeSessionWarning', () => {
  it('names the spot an active session still points at', () => {
    expect(activeSessionWarning(change('AVAILABLE', true))).toMatch(/active session still points at B-3/);
  });
});
