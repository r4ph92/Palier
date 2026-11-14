import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type { SpotPage } from './useSpotPage.ts';

interface SpotPagerProps {
  readonly page: SpotPage;
  // The pager under the table repeats the page turns of the one above it: another landmark name, and no second range.
  readonly below?: boolean;
}

// Shown only for an aisle longer than one page: « 1–50 sur 120 », then the previous and next pages.
export function SpotPager({ page, below = false }: SpotPagerProps) {
  const { text, language } = useLanguage();
  const labels = text.map.spots.page;
  if (!page.hasPrevious && !page.hasNext) {
    return null;
  }
  const range = { first: formatCount(page.first, language), last: formatCount(page.last, language), count: formatCount(page.count, language) };
  return (
    <nav className="spot-pager" aria-label={below ? labels.labelBelow : labels.label}>
      {below ? null : (
        <span className="number-cell" aria-live="polite">
          {interpolate(labels.range, range)}
        </span>
      )}
      <PageTurn label={labels.previous} turn={page.previous} atEdge={!page.hasPrevious} />
      <PageTurn label={labels.next} turn={page.next} atEdge={!page.hasNext} />
    </nav>
  );
}

// At the edge the button is dimmed, not disabled, so keyboard focus stays on it instead of falling to the page body.
function PageTurn({ label, turn, atEdge }: { readonly label: string; readonly turn: () => void; readonly atEdge: boolean }) {
  return (
    <button type="button" className="text-button" aria-disabled={atEdge} onClick={atEdge ? undefined : turn}>
      {label}
    </button>
  );
}
