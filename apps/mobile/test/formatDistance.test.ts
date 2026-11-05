import { applyLanguage } from '../src/i18n/i18n';
import { formatDistance, spokenDistance } from '../src/i18n/formatDistance';
import { NO_BREAK_SPACE } from '../src/i18n/spaces';
import { asSeen } from './visibleText';

describe('formatDistance', () => {
  it.each([
    [0, '0 m', '0 m'],
    [350, '350 m', '350 m'],
    [354, '350 m', '350 m'],
    [569, '570 m', '570 m'],
    [994, '990 m', '990 m'],
    [996, '1 km', '1 km'],
    [1000, '1 km', '1 km'],
    [1234, '1,2 km', '1.2 km'],
    [9960, '10 km', '10 km'],
    [10_000, '10 km', '10 km'],
  ])('writes %i metres as %s and %s', (metres, french, english) => {
    expect(asSeen(formatDistance(metres, 'fr'))).toBe(french);
    expect(asSeen(formatDistance(metres, 'en'))).toBe(english);
  });

  it('keeps the figure and its unit together with a no-break space', () => {
    expect(formatDistance(350, 'fr')).toBe(`350${NO_BREAK_SPACE}m`);
  });
});

describe('spokenDistance', () => {
  it.each([
    ['fr', 350, '350 mètres'],
    ['fr', 1234, '1,2 kilomètres'],
    ['fr', 1000, '1 kilomètre'],
    ['en', 350, '350 metres'],
    ['en', 1234, '1.2 kilometres'],
    ['en', 1000, '1 kilometre'],
  ] as const)('reads %s %i metres as %s', (language, metres, expected) => {
    applyLanguage(language);

    expect(spokenDistance(metres, language)).toBe(expected);
  });
});
