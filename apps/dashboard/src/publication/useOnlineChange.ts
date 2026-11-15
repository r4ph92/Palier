import type { LotPublication } from '@palier/shared-types';
import { useState } from 'react';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { dashboardClient } from '../api/dashboardClient.ts';
import { followUpRefusal } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';

export interface OnlineChangeTarget {
  readonly lotId: string;
  readonly onSaved: (publication: LotPublication) => void;
  readonly onStale: () => Promise<boolean>;
}

// attempt changes with each refusal, so the notice takes focus again even when its text stays the same.
export interface ShownRefusal {
  readonly code: DisplayedErrorCode;
  readonly attempt: number;
}

export interface OnlineChange {
  readonly busy: boolean;
  readonly refusal: ShownRefusal | null;
  readonly change: (online: boolean) => Promise<void>;
}

// LOT_NOT_READY means the checklist changed since it was read: the page reads it again before saying so.
export function useOnlineChange({ lotId, onSaved, onStale }: OnlineChangeTarget): OnlineChange {
  const request = useGuardedRequest();
  const refreshSession = useSessionRefresh();
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null);
  const refreshOn = (code: DisplayedErrorCode) => (code === 'LOT_NOT_READY' ? onStale() : null);
  const change = (online: boolean) =>
    request.run(async () => {
      setRefusal(null);
      try {
        onSaved(await dashboardClient.setLotOnline(lotId, online));
      } catch (failure) {
        const { code } = await followUpRefusal(failure, { refreshSession, refreshOn });
        setRefusal((previous) => ({ code, attempt: (previous?.attempt ?? 0) + 1 }));
      }
    });
  return { busy: request.busy, refusal, change };
}
