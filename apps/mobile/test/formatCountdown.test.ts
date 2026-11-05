import { formatCountdown } from '../src/i18n/formatCountdown';

describe('formatCountdown', () => {
  it.each([
    [900, '15:00'],
    [899, '14:59'],
    [61, '1:01'],
    [9, '0:09'],
    [0, '0:00'],
  ])('writes %i seconds as %s', (seconds, shown) => {
    expect(formatCountdown(seconds)).toBe(shown);
  });
});
