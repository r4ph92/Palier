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

// Asks the list to turn to the page showing one spot; each request has its own key, so the same spot can be asked for twice.
export interface PageRequest {
  readonly key: number;
  readonly spotId: string | null;
}

// The aisle's whole list comes in one read; the page shows 50 rows at a time, and the remembered page never outlives the list.
export function useSpotPage(spots: readonly DashboardSpot[], onTurn: () => void, request: PageRequest): SpotPage {
  const [wantedIndex, setWantedIndex] = useState(0);
  const [answeredKey, setAnsweredKey] = useState(request.key);
  const lastIndex = Math.max(0, Math.ceil(spots.length / PAGE_SIZE) - 1);
  const requestedIndex = answeredKey === request.key ? null : indexOfSpot(spots, request.spotId);
  const index = Math.min(requestedIndex ?? wantedIndex, lastIndex);
  if (answeredKey !== request.key) {
    setAnsweredKey(request.key);
  }
  if (wantedIndex !== index) {
    setWantedIndex(index);
  }
  const turnTo = (nextIndex: number) => {
    setWantedIndex(nextIndex);
    onTurn();
  };
  return { ...pageAt(spots, index), hasPrevious: index > 0, hasNext: index < lastIndex, previous: () => turnTo(index - 1), next: () => turnTo(index + 1) };
}

function indexOfSpot(spots: readonly DashboardSpot[], spotId: string | null): number | null {
  const position = spots.findIndex(({ id }) => id === spotId);
  return position < 0 ? null : Math.floor(position / PAGE_SIZE);
}

function pageAt(spots: readonly DashboardSpot[], index: number): Pick<SpotPage, 'spots' | 'first' | 'last' | 'count'> {
  const start = index * PAGE_SIZE;
  const shown = spots.slice(start, start + PAGE_SIZE);
  return { spots: shown, first: start + 1, last: start + shown.length, count: spots.length };
}
