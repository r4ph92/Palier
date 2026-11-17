/** @typedef {import('./consoleText.js').Language} Language */
/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} LanguageStorage */

// Only the language is kept across visits; the device key is never stored.
const STORAGE_KEY = 'palier.demoConsole.language';
const DEFAULT_LANGUAGE = 'fr';

/**
 * @param {LanguageStorage} storage
 * @returns {Language}
 */
export function restoredLanguage(storage) {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'fr' ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * @param {Language} language
 * @param {LanguageStorage} storage
 */
export function saveLanguage(language, storage) {
  try {
    storage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage is blocked or full: the choice then lasts until the page is reloaded.
  }
}
