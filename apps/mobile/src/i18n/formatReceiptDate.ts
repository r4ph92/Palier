import type { SupportedLanguage } from './i18n';
import { NO_BREAK_SPACE } from './spaces';

const FRENCH_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const ENGLISH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// « 4 nov. 2026 » / « Nov 4, 2026 », written by hand like the clock time: Hermes' Intl on iOS does not follow the backlog's conventions.
export function formatReceiptDate(moment: Date, language: SupportedLanguage): string {
  if (language === 'fr') {
    return `${moment.getDate()}${NO_BREAK_SPACE}${FRENCH_MONTHS[moment.getMonth()]}${NO_BREAK_SPACE}${moment.getFullYear()}`;
  }
  return `${ENGLISH_MONTHS[moment.getMonth()]}${NO_BREAK_SPACE}${moment.getDate()}, ${moment.getFullYear()}`;
}
