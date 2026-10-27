import { describe, expect, it } from 'vitest';
import { formatPassageTime, translate, vehiclesInside } from '../../src/http/demo/consoleText.js';
import { translations } from '../../src/http/demo/consoleTranslations.js';

describe('console translations', () => {
  it('has the same keys in French and English', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.fr).sort());
  });

  it.each([
    ['fr', 'loopENTRY', 'Boucle d’entrée fermée'],
    ['fr', 'loopEXIT', 'Boucle de sortie fermée'],
    ['fr', 'keyRefused', 'Clé d’appareil refusée'],
    ['en', 'loopENTRY', 'Entry loop closed'],
    ['en', 'loopEXIT', 'Exit loop closed'],
    ['en', 'keyRefused', 'Device key refused'],
  ] as const)('%s %s reads "%s"', (language, key, expected) => {
    expect(translate(language, key)).toBe(expected);
  });

  it('fills the placeholders', () => {
    expect(translate('fr', 'gateIdentity', { name: 'Entrée Démo', kind: 'Entrée', lot: 'Parking Démo' })).toBe(
      'Entrée Démo · Entrée · Parking Démo',
    );
  });

  it.each([
    ['fr', 0, '0 véhicule dans le parking'],
    ['fr', 1, '1 véhicule dans le parking'],
    ['fr', 9, '9 véhicules dans le parking'],
    ['en', 0, '0 vehicles in the lot'],
    ['en', 1, '1 vehicle in the lot'],
  ] as const)('%s with %i vehicles reads "%s"', (language, count, expected) => {
    expect(vehiclesInside(count, language)).toBe(expected);
  });
});

describe('formatPassageTime', () => {
  it.each([
    ['fr', new Date(2026, 9, 27, 18, 2), '18 h 02'],
    ['en', new Date(2026, 9, 27, 18, 2), '6:02 PM'],
    ['en', new Date(2026, 9, 27, 0, 5), '12:05 AM'],
    ['en', new Date(2026, 9, 27, 12, 0), '12:00 PM'],
  ] as const)('%s writes %s as %s', (language, moment, expected) => {
    expect(formatPassageTime(moment, language)).toBe(expected);
  });
});
