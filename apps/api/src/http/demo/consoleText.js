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
 * The seconds tell two presses of the arming loop apart; a 24-hour clock reads the same in both languages.
 * @param {Date} moment
 * @returns {string}
 */
export function formatTimeWithSeconds(moment) {
  return [moment.getHours(), moment.getMinutes(), moment.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
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
 *   | { replayed: { count: number, vehicleCount: number }, isError: false }
 *   | { recorded: { closedAt: Date, vehicleCount: number }, isError: false }
 *   | { verifiedAt: Date, isError: false }
 *   | { armedAt: Date, isError: false }} ConsoleMessage
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
  if ('recorded' in message) {
    const { closedAt, vehicleCount } = message.recorded;
    return translate(language, 'passageRecorded', { time: formatTimeWithSeconds(closedAt), vehicles: vehiclesInside(vehicleCount, language) });
  }
  if ('verifiedAt' in message) {
    return translate(language, 'gateVerified', { time: formatPassageTime(message.verifiedAt, language) });
  }
  if ('armedAt' in message) {
    return translate(language, 'armed', { time: formatTimeWithSeconds(message.armedAt) });
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
 * Cuts a line around its figures (time, count) so only those are set in the mono face.
 * @param {string} text
 * @param {readonly string[]} figures in the order they appear in the text
 * @returns {{ text: string, isFigure: boolean }[]}
 */
export function figureSegments(text, figures) {
  const segments = [];
  let cursor = 0;
  for (const figure of figures) {
    const start = text.indexOf(figure, cursor);
    if (start === -1) {
      continue;
    }
    segments.push({ text: text.slice(cursor, start), isFigure: false }, { text: figure, isFigure: true });
    cursor = start + figure.length;
  }
  segments.push({ text: text.slice(cursor), isFigure: false });
  return segments.filter((segment) => segment.text !== '');
}

/**
 * @param {number} count
 * @param {Language} language
 * @returns {boolean}
 */
function isSingular(count, language) {
  return language === 'fr' ? count <= 1 : count === 1;
}
