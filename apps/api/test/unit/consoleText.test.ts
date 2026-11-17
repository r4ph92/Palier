import { describe, expect, it } from 'vitest';
import { formatPassageTime, formatTimeWithSeconds, messageText, passagesReplayed, pendingPassages, translate, vehiclesInside } from '../../src/http/demo/consoleText.js';
import { translations } from '../../src/http/demo/consoleTranslations.js';

describe('console translations', () => {
  it('has the same keys in French and English', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.fr).sort());
  });

  it.each([
    ['fr', 'loopENTRY', 'Boucle d’entrée fermée'],
    ['fr', 'loopEXIT', 'Boucle de sortie fermée'],
    ['fr', 'keyRefused', 'Clé d’appareil refusée : vérifiez la clé collée, puis réessayez.'],
    ['en', 'loopENTRY', 'Entry loop closed'],
    ['en', 'loopEXIT', 'Exit loop closed'],
    ['en', 'keyRefused', 'Device key refused: check the pasted key, then try again.'],
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
    ['en', 'offlineEntryRefused', 'Out of service — entry refused to Palier users'],
    ['fr', 'replayKeyHint', 'Entrez la clé de la barrière pour rejouer les passages en attente.'],
    ['en', 'replayKeyHint', 'Enter the gate’s key to replay the waiting passages.'],
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

  it('writes the arming instant to the second, so two presses are told apart', () => {
    const armedAt = new Date(2026, 10, 16, 9, 5, 7);

    expect(formatTimeWithSeconds(armedAt)).toBe('09:05:07');
    expect(messageText('en', { armedAt, isError: false })).toContain('Loop armed at 09:05:07.');
    expect(messageText('fr', { armedAt, isError: false })).toContain('Boucle armée à 09:05:07.');
  });

  it('writes a plain message without counts as its key', () => {
    expect(messageText('en', { key: 'keyRefused', isError: true })).toBe('Device key refused: check the pasted key, then try again.');
  });
});

describe('recorded passage message', () => {
  const vehicleCount = 0;

  it('changes with the time, so two exits at zero vehicles are announced twice', () => {
    const first = messageText('fr', { recorded: { closedAt: new Date(2026, 10, 17, 14, 3, 12), vehicleCount }, isError: false });
    const second = messageText('fr', { recorded: { closedAt: new Date(2026, 10, 17, 14, 3, 19), vehicleCount }, isError: false });

    expect(first).toBe('Passage enregistré à 14:03:12 · 0 véhicule dans le parking');
    expect(second).not.toBe(first);
  });

  it('reads in English', () => {
    const message = { recorded: { closedAt: new Date(2026, 10, 17, 14, 3, 12), vehicleCount: 12 }, isError: false } as const;

    expect(messageText('en', message)).toBe('Passage recorded at 14:03:12 · 12 vehicles in the lot');
  });
});

describe('refusal messages', () => {
  it.each(['keyRefused', 'gateForbidden', 'passageFailed'] as const)('%s names a next step in both languages', (key) => {
    expect(translate('fr', key)).toContain(`\u00a0:`);
    expect(translate('en', key)).toContain(': ');
  });

  it.each([
    ['wrongLoopENTRY', 'Boucle d’entrée fermée', 'Entry loop closed'],
    ['wrongLoopEXIT', 'Boucle de sortie fermée', 'Exit loop closed'],
  ] as const)('%s names the button to use', (key, frenchLabel, englishLabel) => {
    expect(translate('fr', key)).toContain(frenchLabel);
    expect(translate('en', key)).toContain(englishLabel);
  });
});

describe('French typography', () => {
  it('keeps a no-break space before every colon and semicolon and inside every guillemet pair', () => {
    for (const text of Object.values(translations.fr)) {
      expect(text).not.toMatch(/ [:;»]|«(?!\u00a0)|[^\u00a0\s]»/);
    }
  });
});
