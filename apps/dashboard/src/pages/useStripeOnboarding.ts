import { useState } from 'react';
import { asDashboardApiError, endsSession, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { dashboardClient } from '../api/dashboardClient.ts';
import { redirectTo } from '../navigation/redirectTo.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';

export interface StripeOnboarding {
  readonly redirecting: boolean;
  readonly error: DisplayedErrorCode | null;
  readonly start: () => Promise<void>;
}

// Null once the page is on its way to Stripe; otherwise the failure, and whether it ended the session.
async function requestOnboarding(operatorId: string): Promise<{ readonly code: DisplayedErrorCode; readonly endedSession: boolean } | null> {
  try {
    redirectTo((await dashboardClient.startStripeOnboarding(operatorId)).url);
    return null;
  } catch (failure) {
    const failed = asDashboardApiError(failure);
    return { code: failed.code, endedSession: endsSession(failed) };
  }
}

// On success the page is left for Stripe, so it stays busy; a failure or an ended session frees the button again.
export function useStripeOnboarding(operatorId: string): StripeOnboarding {
  const refreshSession = useSessionRefresh();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const start = async () => {
    if (redirecting) {
      return;
    }
    setError(null);
    setRedirecting(true);
    const failure = await requestOnboarding(operatorId);
    if (failure !== null) {
      setRedirecting(false);
      setError(failure.code);
      if (failure.endedSession) {
        await refreshSession();
      }
    }
  };
  return { redirecting, error, start };
}
