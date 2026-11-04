import { formatElapsed } from '../src/i18n/formatElapsed';
import { asSeen } from './visibleText';

describe('formatElapsed', () => {
  it.each([
    [195, '3 h 15', '3 h 15 min'],
    [600, '10 h 00', '10 h 00 min'],
    [65, '1 h 05', '1 h 05 min'],
    [14, '14 min', '14 min'],
    [0, '0 min', '0 min'],
  ])('writes %i minutes as %s and %s', (minutes, french, english) => {
    expect(asSeen(formatElapsed(minutes, 'fr'))).toBe(french);
    expect(asSeen(formatElapsed(minutes, 'en'))).toBe(english);
  });
});
