import { getLocales } from 'expo-localization';
import { SPOT_CATEGORIES } from '@palier/shared-types/lots';
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
    ['fr', 0, 'place libre'],
    ['fr', 1, 'place libre'],
    ['fr', 10, 'places libres'],
    ['en', 0, 'free spots'],
    ['en', 1, 'free spot'],
    ['en', 10, 'free spots'],
  ] as const)('%s with %i reads "%s"', (language, count, expected) => {
    applyLanguage(language);

    expect(i18n.t('home.freeSpotsLabel', { count })).toBe(expected);
  });
});

describe('spot category labels', () => {
  it.each(['fr', 'en'] as const)('names every category in %s', (language) => {
    applyLanguage(language);

    expect(SPOT_CATEGORIES.map((category) => i18n.t(`home.categories.${category}`))).not.toContainEqual(expect.stringMatching(/missing/));
  });
});
