import { formatClockTime } from '../src/i18n/formatClockTime';

const afternoon = new Date(2026, 9, 27, 13, 25);

describe('formatClockTime', () => {
  it('writes the French time as 13 h 25', () => {
    expect(formatClockTime(afternoon, 'fr')).toBe('13 h 25');
  });

  it('writes the English time as 1:25 PM', () => {
    expect(formatClockTime(afternoon, 'en')).toBe('1:25 PM');
  });

  it.each([
    [new Date(2026, 9, 27, 0, 5), '0 h 05', '12:05 AM'],
    [new Date(2026, 9, 27, 12, 0), '12 h 00', '12:00 PM'],
  ])('handles %s at the day edges', (moment, french, english) => {
    expect(formatClockTime(moment, 'fr')).toBe(french);
    expect(formatClockTime(moment, 'en')).toBe(english);
  });
});
