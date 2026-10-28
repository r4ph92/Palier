import { describe, expect, it } from 'vitest';
import { parseSpotStateArguments } from '../../src/seed/spotStateArguments.ts';

describe('parseSpotStateArguments', () => {
  it('reads the lot, the spot and the state', () => {
    const change = parseSpotStateArguments(['--lot', 'Parking Démo', '--spot', 'A-1', '--state', 'OUT_OF_SERVICE']);

    expect(change).toEqual({ lotName: 'Parking Démo', spotNumber: 'A-1', state: 'OUT_OF_SERVICE' });
  });

  it('refuses an unknown state', () => {
    expect(() => parseSpotStateArguments(['--lot', 'Parking Démo', '--spot', 'A-1', '--state', 'BROKEN'])).toThrow(
      /Unknown state "BROKEN"/,
    );
  });

  it('shows the usage when an argument is missing', () => {
    expect(() => parseSpotStateArguments(['--lot', 'Parking Démo'])).toThrow(/Usage: npm run seed:spot-state/);
  });
});
