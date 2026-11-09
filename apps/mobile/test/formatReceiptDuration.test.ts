import { formatReceiptDuration } from '../src/i18n/formatReceiptDuration';
import { asSeen } from './visibleText';

describe('formatReceiptDuration', () => {
  it.each([
    [195, '3 h 15'],
    [60, '1 h 00'],
    [61, '1 h 01'],
    [45, '45 min'],
    [0, '0 min'],
    [1560, '26 h 00'],
  ])('writes %i minutes as %s', (minutes, expected) => {
    expect(asSeen(formatReceiptDuration(minutes))).toBe(expected);
  });
});
