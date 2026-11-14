import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import type { SpotPage } from './useSpotPage.ts';

// Shown only for an aisle longer than one page: « 1–50 sur 120 », then the previous and next pages.
export function SpotPager({ page }: { readonly page: SpotPage }) {
  const { text, language } = useLanguage();
  const labels = text.map.spots.page;
  if (page.count <= page.last - page.first + 1) {
    return null;
  }
  const range = { first: formatCount(page.first, language), last: formatCount(page.last, language), count: formatCount(page.count, language) };
  return (
    <nav className="spot-pager" aria-label={labels.label}>
      <span className="number-cell" aria-live="polite">
        {interpolate(labels.range, range)}
      </span>
      <PageTurns page={page} />
    </nav>
  );
}

function PageTurns({ page }: { readonly page: SpotPage }) {
  const labels = useText().map.spots.page;
  return (
    <>
      <button type="button" className="text-button" disabled={!page.hasPrevious} onClick={page.previous}>
        {labels.previous}
      </button>
      <button type="button" className="text-button" disabled={!page.hasNext} onClick={page.next}>
        {labels.next}
      </button>
    </>
  );
}
