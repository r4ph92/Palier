import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import type { ReactNode } from 'react';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import type { SpotPage } from './useSpotPage.ts';

interface PageTurnsProps {
  readonly page: SpotPage;
  readonly label: string;
}

// Shown only for an aisle longer than one page: « 1–50 sur 120 », then the previous and next pages.
export function SpotPager({ page }: { readonly page: SpotPage }) {
  const { text, language } = useLanguage();
  const labels = text.map.spots.page;
  const range = { first: formatCount(page.first, language), last: formatCount(page.last, language), count: formatCount(page.count, language) };
  return (
    <PageTurns page={page} label={labels.label}>
      <span className="number-cell" aria-live="polite">
        {interpolate(labels.range, range)}
      </span>
    </PageTurns>
  );
}

// The turns alone, for the pager under the table: another landmark name, and no second range.
export function PageTurns({ page, label, children }: PageTurnsProps & { readonly children?: ReactNode }) {
  const labels = useText().map.spots.page;
  if (!page.hasPrevious && !page.hasNext) {
    return null;
  }
  return (
    <nav className="spot-pager" aria-label={label}>
      {children}
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
