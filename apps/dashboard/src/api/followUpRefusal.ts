import { asDashboardApiError, endsSession, type DisplayedErrorCode } from './DashboardApiError.ts';

export interface Refusal {
  readonly code: DisplayedErrorCode;
  readonly values: Readonly<Record<string, string>>;
}

export interface RefusalFollowUps {
  readonly refreshSession: () => Promise<void>;
  // Reads again what the refusal says is out of date and answers whether that read succeeded; null when nothing is.
  readonly refreshOn?: (code: DisplayedErrorCode) => Promise<boolean> | null;
  // Shown instead of the refusal when that read failed, since the refusal's sentence says the page was reloaded.
  readonly reloadFailedCode?: DisplayedErrorCode;
}

export type StaleDataFollowUps = Omit<RefusalFollowUps, 'refreshSession'>;

// A 401 reads the session again; a refusal about stale data reads that data again before the page says why it refused.
export async function followUpRefusal(failure: unknown, { refreshSession, refreshOn, reloadFailedCode = 'UNKNOWN' }: RefusalFollowUps): Promise<Refusal> {
  const refusal = asDashboardApiError(failure);
  const { code, values } = refusal;
  if (endsSession(refusal)) {
    void refreshSession();
  }
  const refresh = refreshOn?.(code) ?? null;
  if (refresh === null || (await refresh)) {
    return { code, values };
  }
  return { code: reloadFailedCode, values: {} };
}
