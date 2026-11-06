import { describe, expect, it } from 'vitest';
import { chooseSpot, type FreeSpot } from '../../src/domain/allocation/chooseSpot.ts';
import { freeSpotFixture } from './fakes/freeSpotFixture.ts';

function spot(number: string, levelOrder: number, distanceToExit: number): FreeSpot {
  return freeSpotFixture(number, { levelOrder, distanceToExit });
}

const A2 = spot('A-2', 1, 10);
const C1 = spot('C-1', 2, 10);
const C2 = spot('C-2', 2, 5);
const C3 = spot('C-3', 2, 15);
const D1 = spot('D-1', 2, 5);

describe('chooseSpot', () => {
  it('picks the first level with a free spot even when a later level has more', () => {
    expect(chooseSpot([C1, C2, C3, D1, A2])?.number).toBe('A-2');
  });

  it('picks the aisle with the most free spots, then the spot nearest the exit', () => {
    expect(chooseSpot([C1, C2, C3, D1])?.number).toBe('C-2');
  });

  it('keeps filling the fullest aisle while it still has more free spots than the others', () => {
    expect(chooseSpot([C1, C3, D1])?.number).toBe('C-1');
  });

  it('picks the aisle with the lower code when free counts are equal', () => {
    expect(chooseSpot([D1, spot('C-9', 2, 50)])?.number).toBe('C-9');
  });

  it('prefers an unflagged spot over a nearer flagged one', () => {
    expect(chooseSpot([{ ...spot('A-1', 1, 5), needsCheck: true }, spot('A-2', 1, 20)])?.number).toBe('A-2');
  });

  it('assigns a flagged spot when only flagged spots are free', () => {
    expect(chooseSpot([{ ...spot('A-1', 1, 5), needsCheck: true }])?.number).toBe('A-1');
  });

  it('returns null when no spot is free', () => {
    expect(chooseSpot([])).toBeNull();
  });
});
