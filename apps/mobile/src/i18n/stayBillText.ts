import type { ReceiptLine } from '@palier/shared-types';
import { formatMoney } from './formatMoney';
import { formatReceiptDuration } from './formatReceiptDuration';
import { currentLanguage, i18n } from './i18n';
import { NO_BREAK_SPACE } from './spaces';

const MINUTES_PER_HOUR = 60;

// « 6 h » for whole hours, « 6 h 15 » or « 45 min » otherwise, ahead of « supplémentaires ».
function extraDuration(minutes: number): string {
  return minutes % MINUTES_PER_HOUR === 0 ? `${minutes / MINUTES_PER_HOUR}${NO_BREAK_SPACE}h` : formatReceiptDuration(minutes);
}

// « 24 premières heures », « 24 heures suivantes » or « 6 h supplémentaires »: the name of one line of the bill.
export function stayLineLabel(line: ReceiptLine): string {
  if (line.kind === 'EXTRA') {
    return i18n.t('session.exit.receipt.extra', { duration: extraDuration(line.minutes) });
  }
  return i18n.t(line.dayNumber === 1 ? 'session.exit.receipt.firstDay' : 'session.exit.receipt.nextDay');
}

// A full day is held at the daily cap, and says so.
export function stayLineAmount(line: ReceiptLine): string {
  const amount = formatMoney(line.cents, currentLanguage());
  return line.kind === 'DAY' ? `${amount} ${i18n.t('session.exit.receipt.capNote')}` : amount;
}

// « 24 premières heures : 25,00 $ (plafond) », « Total : 43,00 $ »: one line of the bill as a sentence.
export function billSentence(label: string, amount: string): string {
  return i18n.t('session.exit.receipt.lineAmount', { label, amount });
}
