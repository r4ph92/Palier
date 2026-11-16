import { describe, expect, it } from 'vitest';
import { formatClockTimeWithSeconds } from '../src/i18n/formatNumbers.ts';

const MOMENT = new Date('2026-11-15T14:02:05');

describe('formatting the time of a step with its seconds', () => {
  it('reads « 14 h 02 min 05 s » in French', () => {
    expect(formatClockTimeWithSeconds(MOMENT, 'fr')).toBe('14 h 02 min 05 s');
  });

  it('reads "2:02:05 PM" in English', () => {
    expect(formatClockTimeWithSeconds(MOMENT, 'en').replace(/\s/g, ' ')).toBe('2:02:05 PM');
  });
});
