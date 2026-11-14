import { useState } from 'react';

const PAGE_SIZE = 50;

export interface SpotPage<Item = unknown> {
  readonly spots: readonly Item[];
  // Positions shown, counted from 1, and the aisle's whole count.
  readonly first: number;
  readonly last: number;
  readonly count: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly previous: () => void;
  readonly next: () => void;
}

// The whole list comes in one read; the page shows 50 rows at a time, and stays on the last page when spots go.
export function useSpotPage<Item>(spots: readonly Item[], onTurn: () => void): SpotPage<Item> {
  const [wantedIndex, setWantedIndex] = useState(0);
  const lastIndex = Math.max(0, Math.ceil(spots.length / PAGE_SIZE) - 1);
  const index = Math.min(wantedIndex, lastIndex);
  const turnTo = (nextIndex: number) => {
    setWantedIndex(nextIndex);
    onTurn();
  };
  return { ...pageAt(spots, index), hasPrevious: index > 0, hasNext: index < lastIndex, previous: () => turnTo(index - 1), next: () => turnTo(index + 1) };
}

function pageAt<Item>(spots: readonly Item[], index: number): Pick<SpotPage<Item>, 'spots' | 'first' | 'last' | 'count'> {
  const start = index * PAGE_SIZE;
  const shown = spots.slice(start, start + PAGE_SIZE);
  return { spots: shown, first: start + 1, last: start + shown.length, count: spots.length };
}
