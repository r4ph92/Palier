import { formatClockTime } from '../src/i18n/formatClockTime';

const afternoon = new Date(2026, 9, 27, 13, 25);

describe('formatClockTime', () => {
  it('writes the French time as 13 h 25', () => {
    expect(formatClockTime(afternoon, 'fr')).toBe('13 h 25');
  });

  it('writes the English time as 1:25 PM', () => {
    expect(formatClockTime(afternoon, 'en')).toBe('1:25 PM');
  });
});
