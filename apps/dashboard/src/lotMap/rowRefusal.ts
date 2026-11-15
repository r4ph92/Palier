import type { DashboardSpot } from '@palier/shared-types';
import type { Refusal } from '../api/followUpRefusal.ts';
import type { SpotNotice } from './useSpotChanges.ts';

const ROW_REFUSALS: readonly string[] = ['SPOT_IN_USE', 'LOT_BUSY'];

// A refusal about one spot that is still on the page's rows.
export interface RowRefusal {
  readonly spotId: string;
  readonly refusal: Refusal;
  readonly noticeKey: number;
}

export function rowRefusalOf(notice: SpotNotice | null, noticeKey: number, rows: readonly DashboardSpot[]): RowRefusal | null {
  if (notice?.kind !== 'refused' || notice.spotId === null || !ROW_REFUSALS.includes(notice.refusal.code)) {
    return null;
  }
  const { spotId, refusal } = notice;
  return rows.some(({ id }) => id === spotId) ? { spotId, refusal, noticeKey } : null;
}
