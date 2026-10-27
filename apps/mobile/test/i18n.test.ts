import { getLocales } from 'expo-localization';
import { applyLanguage, deviceLanguage, i18n } from '../src/i18n/i18n';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const mockedGetLocales = jest.mocked(getLocales);

function deviceSpeaks(languageCode: string | null): void {
  mockedGetLocales.mockReturnValue([{ languageCode } as ReturnType<typeof getLocales>[number]]);
}

describe('deviceLanguage', () => {
  it('follows an English device', () => {
    deviceSpeaks('en');

    expect(deviceLanguage()).toBe('en');
  });

  it.each(['fr', 'es', null])('falls back to French for %s', (languageCode) => {
    deviceSpeaks(languageCode);

    expect(deviceLanguage()).toBe('fr');
  });
});

describe('free spot plurals', () => {
  it.each([
    ['fr', 0, '0 place libre'],
    ['fr', 1, '1 place libre'],
    ['fr', 10, '10 places libres'],
    ['en', 0, '0 free spots'],
    ['en', 1, '1 free spot'],
    ['en', 10, '10 free spots'],
  ] as const)('%s with %i reads "%s"', (language, count, expected) => {
    applyLanguage(language);

    expect(i18n.t('home.freeSpots', { count })).toBe(expected);
  });
});
