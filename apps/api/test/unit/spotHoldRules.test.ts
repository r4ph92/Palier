import { describe, expect, it } from 'vitest';
import { spotHoldExpiry } from '../../src/domain/spotHolds/spotHoldRules.ts';

describe('spotHoldExpiry', () => {
  it('ends a hold taken at 14 h 02 at 14 h 17', () => {
    expect(spotHoldExpiry(new Date('2026-11-04T19:02:00Z'))).toEqual(new Date('2026-11-04T19:17:00Z'));
  });

  it('keeps the seconds of the request', () => {
    expect(spotHoldExpiry(new Date('2026-11-04T19:02:31.250Z'))).toEqual(new Date('2026-11-04T19:17:31.250Z'));
  });
});
