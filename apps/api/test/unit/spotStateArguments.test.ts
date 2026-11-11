import { describe, expect, it } from 'vitest';
import { parseSpotStateArguments } from '../../src/seed/spotStateArguments.ts';

describe('parseSpotStateArguments', () => {
  it('reads the lot, the spot and the state', () => {
    const change = parseSpotStateArguments(['--lot', 'Parking Démo', '--spot', 'A-1', '--state', 'OUT_OF_SERVICE']);

    expect(change).toEqual({ lotName: 'Parking Démo', spotNumber: 'A-1', state: 'OUT_OF_SERVICE', forceActiveSession: false });
  });

  it('reads the force flag for an active session', () => {
    const change = parseSpotStateArguments(['--lot', 'Parking Démo', '--spot', 'B-3', '--state', 'AVAILABLE', '--force-active-session']);

    expect(change.forceActiveSession).toBe(true);
  });

  it('refuses an unknown state and lists only the states a person may set', () => {
    expect(() => parseSpotStateArguments(['--lot', 'Parking Démo', '--spot', 'A-1', '--state', 'BROKEN'])).toThrow(
      'Unknown state "BROKEN". Expected one of: AVAILABLE, OCCUPIED, OCCUPIED_UNKNOWN, OUT_OF_SERVICE.',
    );
  });

  it('refuses HELD, which only a spot hold sets', () => {
    expect(() => parseSpotStateArguments(['--lot', 'Parking Démo', '--spot', 'A-1', '--state', 'HELD'])).toThrow(/Unknown state "HELD"/);
  });

  it('refuses ASSIGNED, which only an entry sets', () => {
    expect(() => parseSpotStateArguments(['--lot', 'Parking Démo', '--spot', 'A-1', '--state', 'ASSIGNED'])).toThrow(/Unknown state "ASSIGNED"/);
  });

  it('shows the usage when an argument is missing', () => {
    expect(() => parseSpotStateArguments(['--lot', 'Parking Démo'])).toThrow(/Usage: npm run seed:spot-state/);
  });
});
