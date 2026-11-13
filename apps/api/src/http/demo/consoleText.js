import { translations } from './consoleTranslations.js';

/** @typedef {keyof typeof translations} Language */
/** @typedef {keyof typeof translations.fr} TextKey */

const HOURS_PER_HALF_DAY = 12;
const NO_BREAK_SPACE = ' ';

/**
 * @param {Language} language
 * @param {TextKey} key
 * @param {Record<string, string | number>} [values]
 * @returns {string}
 */
export function translate(language, key, values = {}) {
  return translations[language][key].replace(/\{(\w+)\}/g, (placeholder, name) => String(values[name] ?? placeholder));
}

/**
 * @param {Date} moment
 * @param {Language} language
 * @returns {string}
 */
export function formatPassageTime(moment, language) {
  const minutes = String(moment.getMinutes()).padStart(2, '0');
  if (language === 'fr') {
    return `${moment.getHours()}${NO_BREAK_SPACE}h${NO_BREAK_SPACE}${minutes}`;
  }
  const period = moment.getHours() < HOURS_PER_HALF_DAY ? 'AM' : 'PM';
  const hour = moment.getHours() % HOURS_PER_HALF_DAY === 0 ? HOURS_PER_HALF_DAY : moment.getHours() % HOURS_PER_HALF_DAY;
  return `${hour}:${minutes}${NO_BREAK_SPACE}${period}`;
}

/**
 * @param {number} count
 * @param {Language} language
 * @returns {string}
 */
export function vehiclesInside(count, language) {
  return translate(language, isSingular(count, language) ? 'vehiclesInsideOne' : 'vehiclesInsideOther', { count });
}

/**
 * @param {number} count
 * @param {Language} language
 * @returns {string}
 */
export function pendingPassages(count, language) {
  return translate(language, isSingular(count, language) ? 'pendingPassagesOne' : 'pendingPassagesOther', { count });
}

/**
 * @param {number} count
 * @param {number} vehicleCount
 * @param {Language} language
 * @returns {string}
 */
export function passagesReplayed(count, vehicleCount, language) {
  const key = isSingular(count, language) ? 'passagesReplayedOne' : 'passagesReplayedOther';
  return translate(language, key, { count, vehicles: vehiclesInside(vehicleCount, language) });
}

/**
 * @typedef {{ key: TextKey, isError: boolean, tone?: 'degraded' | 'muted' }
 *   | { replayed: { count: number, vehicleCount: number }, isError: false }} ConsoleMessage
 */

/**
 * @param {Language} language
 * @param {ConsoleMessage} message
 * @returns {string}
 */
export function messageText(language, message) {
  if ('replayed' in message) {
    return passagesReplayed(message.replayed.count, message.replayed.vehicleCount, language);
  }
  return translate(language, message.key);
}

/**
 * @param {ConsoleMessage | null} message
 * @param {TextKey} key
 * @returns {boolean}
 */
export function isMessageKey(message, key) {
  return message !== null && 'key' in message && message.key === key;
}

/**
 * @param {number} count
 * @param {Language} language
 * @returns {boolean}
 */
function isSingular(count, language) {
  return language === 'fr' ? count <= 1 : count === 1;
}
