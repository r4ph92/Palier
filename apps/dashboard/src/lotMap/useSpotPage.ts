import { useState } from 'react';

const PAGE_SIZE = 50;

export interface SpotPage<Item = unknown> {
  readonly spots: readonly Item[];
  // Positions shown, counted from 1, and the list's whole count.
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

export interface PageTurning<Item> {
  readonly idOf: (item: Item) => string;
  readonly onTurn: () => void;
  readonly request: PageRequest;
}

// The whole list comes in one read; the page shows 50 rows at a time, and the remembered page never outlives the list.
export function useSpotPage<Item>(spots: readonly Item[], { idOf, onTurn, request }: PageTurning<Item>): SpotPage<Item> {
  const [wantedIndex, setWantedIndex] = useState(0);
  const [answeredKey, setAnsweredKey] = useState(request.key);
  const lastIndex = Math.max(0, Math.ceil(spots.length / PAGE_SIZE) - 1);
  const requestedIndex = answeredKey === request.key ? null : pageIndexOf(spots, request.spotId, idOf);
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

function pageIndexOf<Item>(spots: readonly Item[], spotId: string | null, idOf: (item: Item) => string): number | null {
  const position = spots.findIndex((spot) => idOf(spot) === spotId);
  return position < 0 ? null : Math.floor(position / PAGE_SIZE);
}

function pageAt<Item>(spots: readonly Item[], index: number): Pick<SpotPage<Item>, 'spots' | 'first' | 'last' | 'count'> {
  const start = index * PAGE_SIZE;
  const shown = spots.slice(start, start + PAGE_SIZE);
  return { spots: shown, first: start + 1, last: start + shown.length, count: spots.length };
}
