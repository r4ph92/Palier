import type { DashboardSpot } from '@palier/shared-types';
import { useState } from 'react';

const PAGE_SIZE = 50;

export interface SpotPage {
  readonly spots: readonly DashboardSpot[];
  // Positions shown, counted from 1, and the aisle's whole count.
  readonly first: number;
  readonly last: number;
  readonly count: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly previous: () => void;
  readonly next: () => void;
}

// The aisle's whole list comes in one read; the page shows 50 rows at a time, and stays on the last page when spots go.
export function useSpotPage(spots: readonly DashboardSpot[], onTurn: () => void): SpotPage {
  const [wantedIndex, setWantedIndex] = useState(0);
  const lastIndex = Math.max(0, Math.ceil(spots.length / PAGE_SIZE) - 1);
  const index = Math.min(wantedIndex, lastIndex);
  const turnTo = (nextIndex: number) => {
    setWantedIndex(nextIndex);
    onTurn();
  };
  return { ...pageAt(spots, index), hasPrevious: index > 0, hasNext: index < lastIndex, previous: () => turnTo(index - 1), next: () => turnTo(index + 1) };
}

function pageAt(spots: readonly DashboardSpot[], index: number): Pick<SpotPage, 'spots' | 'first' | 'last' | 'count'> {
  const start = index * PAGE_SIZE;
  const shown = spots.slice(start, start + PAGE_SIZE);
  return { spots: shown, first: start + 1, last: start + shown.length, count: spots.length };
}
