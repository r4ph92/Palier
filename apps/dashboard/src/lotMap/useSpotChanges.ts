import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { useState } from 'react';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { type Refusal, type StaleDataFollowUps } from '../api/followUpRefusal.ts';

// After these refusals the spot list on the page is out of date: it is read again before the operator retries.
const LIST_OUT_OF_DATE: readonly DisplayedErrorCode[] = ['LOT_BUSY', 'SPOT_NOT_FOUND'];

interface SpotChangeSources {
  readonly show: (spots: DashboardAisleSpots) => void;
  readonly refresh: () => Promise<boolean>;
  readonly onStale: () => Promise<boolean>;
}

export interface AddedSpots {
  readonly count: number;
  readonly aisle: string;
}

// What the line under the list title says about the last change: kept as data, so it follows a language switch.
export type SpotNotice =
  | { readonly kind: 'added'; readonly added: AddedSpots }
  | { readonly kind: 'saved' | 'deleted'; readonly number: string }
  | { readonly kind: 'refused'; readonly refusal: Refusal };

export interface SpotChanges {
  readonly notice: SpotNotice | null;
  // Changes with every notice, so the same refusal twice takes focus twice.
  readonly noticeKey: number;
  readonly added: (spots: DashboardAisleSpots, added: AddedSpots) => void;
  readonly saved: (spots: DashboardAisleSpots, spot: DashboardSpot) => void;
  readonly deleted: (spots: DashboardAisleSpots, spot: DashboardSpot) => void;
  readonly refused: (refusal: Refusal) => void;
  readonly staleData: StaleDataFollowUps;
}

// Every write shows the aisle's spots as the API answered them, then says what changed; the latest change replaces the last notice.
export function useSpotChanges({ show, refresh, onStale }: SpotChangeSources): SpotChanges {
  const [{ notice, noticeKey }, setState] = useState<{ readonly notice: SpotNotice | null; readonly noticeKey: number }>({ notice: null, noticeKey: 0 });
  const setNotice = (next: SpotNotice) => setState((previous) => ({ notice: next, noticeKey: previous.noticeKey + 1 }));
  const showWith = (spots: DashboardAisleSpots, changed: SpotNotice) => {
    show(spots);
    setNotice(changed);
  };
  return {
    notice,
    noticeKey,
    added: (spots, added) => showWith(spots, { kind: 'added', added }),
    saved: (spots, { number }) => showWith(spots, { kind: 'saved', number }),
    deleted: (spots, { number }) => showWith(spots, { kind: 'deleted', number }),
    refused: (refusal) => setNotice({ kind: 'refused', refusal }),
    staleData: { refreshOn: (code) => refreshOn(code, { refresh, onStale }), reloadFailedCode: 'SPOT_RELOAD_FAILED' },
  };
}

function refreshOn(code: DisplayedErrorCode, { refresh, onStale }: Omit<SpotChangeSources, 'show'>): Promise<boolean> | null {
  if (code === 'AISLE_NOT_FOUND') {
    return onStale();
  }
  return LIST_OUT_OF_DATE.includes(code) ? refresh() : null;
}
