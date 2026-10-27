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
  const isSingular = language === 'fr' ? count <= 1 : count === 1;
  return translate(language, isSingular ? 'vehiclesInsideOne' : 'vehiclesInsideOther', { count });
}
