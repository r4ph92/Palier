import { describe, expect, it } from 'vitest';
import { restoredLanguage, saveLanguage } from '../../src/http/demo/languageStorage.js';

function storageHolding(initial: string | null) {
  const items = new Map<string, string>(initial === null ? [] : [['palier.demoConsole.language', initial]]);
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('the stored console language', () => {
  it('stays English after a reload', () => {
    const storage = storageHolding(null);

    saveLanguage('en', storage);

    expect(restoredLanguage(storage)).toBe('en');
  });

  it('starts in French when nothing is stored', () => {
    expect(restoredLanguage(storageHolding(null))).toBe('fr');
  });

  it.each(['de', '', 'EN', '{"language":"en"}'])('ignores the stored value %j', (stored) => {
    expect(restoredLanguage(storageHolding(stored))).toBe('fr');
  });

  it('stores the language and nothing else', () => {
    const storage = storageHolding(null);

    saveLanguage('en', storage);

    expect([...storage.items.values()]).toEqual(['en']);
  });

  it('works without storage', () => {
    expect(restoredLanguage(throwingStorage)).toBe('fr');
    expect(() => saveLanguage('en', throwingStorage)).not.toThrow();
  });
});
