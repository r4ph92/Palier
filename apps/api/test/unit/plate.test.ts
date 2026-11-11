import { describe, expect, it } from 'vitest';
import { readPlate, readTransponder } from '../../src/domain/vehicles/plate.ts';

describe('readPlate', () => {
  it('shows the plate upper-case with its spaces and matches it without them', () => {
    expect(readPlate(' abc 123 ')).toEqual({ plate: 'ABC 123', plateKey: 'ABC123' });
  });

  it('keeps hyphens in the plate, and leaves them out of the match key', () => {
    expect(readPlate('ab-12')).toEqual({ plate: 'AB-12', plateKey: 'AB12' });
    expect(readPlate('ABC-9')?.plateKey).toBe(readPlate('ABC9')?.plateKey);
  });

  it('accepts a plate of exactly eight characters', () => {
    expect(readPlate('ABCD1234')).toEqual({ plate: 'ABCD1234', plateKey: 'ABCD1234' });
  });

  it('refuses an empty plate or one made only of spaces', () => {
    expect(readPlate('')).toBeNull();
    expect(readPlate('   ')).toBeNull();
  });

  it('refuses a plate made only of hyphens and spaces', () => {
    expect(readPlate('-')).toBeNull();
    expect(readPlate('--')).toBeNull();
    expect(readPlate(' - ')).toBeNull();
  });

  it('refuses a plate longer than eight characters', () => {
    expect(readPlate('ABCD12345')).toBeNull();
  });

  it('refuses non-ASCII letters rather than converting them when upper-casing', () => {
    expect(readPlate('ſBC 123')).toBeNull();
    expect(readPlate('ß1 2')).toBeNull();
    expect(readPlate('ＡＢＣ１２３')).toBeNull();
  });

  it('refuses characters other than letters, digits, spaces and hyphens', () => {
    expect(readPlate('AB_123')).toBeNull();
    expect(readPlate('AB.123')).toBeNull();
    expect(readPlate('ÉT-123')).toBeNull();
  });
});

describe('readTransponder', () => {
  it('matches "t-0042", "T0042" and "t 0042" as one identifier', () => {
    expect(readTransponder('t-0042')).toEqual({ transponder: 'T-0042', transponderKey: 'T0042' });
    expect(readTransponder('T0042')?.transponderKey).toBe('T0042');
    expect(readTransponder('t 0042')?.transponderKey).toBe('T0042');
  });

  it('refuses an empty, too long or odd identifier', () => {
    expect(readTransponder('')).toBeNull();
    expect(readTransponder('T-00420042')).toBeNull();
    expect(readTransponder('T_0042')).toBeNull();
  });
});
