import { describe, expect, it } from 'vitest';
import { formatPassageTime, messageText, passagesReplayed, pendingPassages, translate, vehiclesInside } from '../../src/http/demo/consoleText.js';
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

describe('offline texts', () => {
  it.each([
    ['fr', 'offlineEntryRefused', 'Hors service — entrée refusée aux usagers Palier'],
    ['fr', 'offlineExitOpened', 'Sortie ouverte sans condition'],
    ['fr', 'offlineToggle', 'Hors ligne'],
    ['fr', 'clearQueue', 'Vider la file'],
    ['en', 'offlineEntryRefused', 'Out of service — entry refused'],
    ['en', 'offlineExitOpened', 'Exit opened unconditionally'],
    ['en', 'offlineToggle', 'Offline'],
    ['en', 'clearQueue', 'Clear queue'],
  ] as const)('%s %s reads "%s"', (language, key, expected) => {
    expect(translate(language, key)).toBe(expected);
  });

  it.each([
    ['fr', 0, '0 passage en attente'],
    ['fr', 1, '1 passage en attente'],
    ['fr', 2, '2 passages en attente'],
    ['en', 0, '0 passages waiting'],
    ['en', 1, '1 passage waiting'],
    ['en', 2, '2 passages waiting'],
  ] as const)('%s with %i waiting reads "%s"', (language, count, expected) => {
    expect(pendingPassages(count, language)).toBe(expected);
  });

  it.each([
    ['fr', { count: 2, vehicleCount: 3 }, '2 passages rejoués · 3 véhicules dans le parking'],
    ['fr', { count: 1, vehicleCount: 1 }, '1 passage rejoué · 1 véhicule dans le parking'],
    ['en', { count: 2, vehicleCount: 3 }, '2 passages replayed · 3 vehicles in the lot'],
    ['en', { count: 1, vehicleCount: 1 }, '1 passage replayed · 1 vehicle in the lot'],
  ] as const)('%s replay of %o reads "%s"', (language, { count, vehicleCount }, expected) => {
    expect(passagesReplayed(count, vehicleCount, language)).toBe(expected);
  });

  it('writes a replay message through the same text', () => {
    expect(messageText('fr', { replayed: { count: 2, vehicleCount: 3 }, isError: false })).toBe(passagesReplayed(2, 3, 'fr'));
  });

  it('writes a plain message without counts as its key', () => {
    expect(messageText('en', { key: 'keyRefused', isError: true })).toBe('Device key refused');
  });
});
