import { formatReceiptDate } from '../src/i18n/formatReceiptDate';

describe('formatReceiptDate', () => {
  const moment = new Date(2026, 10, 4, 18, 2);

  it('writes day, short month and year in French', () => {
    expect(formatReceiptDate(moment, 'fr')).toBe('4 nov. 2026');
  });

  it('writes short month, day and year in English', () => {
    expect(formatReceiptDate(moment, 'en')).toBe('Nov 4, 2026');
  });

  it('keeps every month abbreviation distinct', () => {
    const months = Array.from({ length: 12 }, (_, month) => formatReceiptDate(new Date(2026, month, 1), 'fr'));

    expect(new Set(months).size).toBe(12);
  });
});
