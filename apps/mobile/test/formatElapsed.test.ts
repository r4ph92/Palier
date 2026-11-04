import { formatElapsed } from '../src/i18n/formatElapsed';

function withRegularSpaces(text: string): string {
  return text.replace(/\u00A0/g, ' ');
}

describe('formatElapsed', () => {
  it.each([
    [195, '3 h 15', '3 h 15 min'],
    [600, '10 h 00', '10 h 00 min'],
    [65, '1 h 05', '1 h 05 min'],
    [14, '14 min', '14 min'],
    [0, '0 min', '0 min'],
  ])('writes %i minutes as %s and %s', (minutes, french, english) => {
    expect(withRegularSpaces(formatElapsed(minutes, 'fr'))).toBe(french);
    expect(withRegularSpaces(formatElapsed(minutes, 'en'))).toBe(english);
  });
});
