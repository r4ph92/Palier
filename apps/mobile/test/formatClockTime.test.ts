import { formatClockTime } from '../src/i18n/formatClockTime';

function withRegularSpaces(text: string): string {
  return text.replace(/\u00A0/g, ' ');
}

const afternoon = new Date(2026, 9, 27, 13, 25);

describe('formatClockTime', () => {
  it('writes the French time as 13 h 25 with no-break spaces', () => {
    expect(formatClockTime(afternoon, 'fr')).toBe('13\u00A0h\u00A025');
  });

  it('writes the English time as 1:25 PM with a no-break space', () => {
    expect(formatClockTime(afternoon, 'en')).toBe('1:25\u00A0PM');
  });

  it.each([
    [new Date(2026, 9, 27, 0, 5), '0 h 05', '12:05 AM'],
    [new Date(2026, 9, 27, 12, 0), '12 h 00', '12:00 PM'],
  ])('handles %s at the day edges', (moment, french, english) => {
    expect(withRegularSpaces(formatClockTime(moment, 'fr'))).toBe(french);
    expect(withRegularSpaces(formatClockTime(moment, 'en'))).toBe(english);
  });
});
