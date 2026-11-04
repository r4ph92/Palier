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
    try {
      redirectTo((await dashboardClient.startStripeOnboarding(operatorId)).url);
    } catch (failure) {
      const failed = asDashboardApiError(failure);
      setRedirecting(false);
      setError(failed.code);
      if (endsSession(failed)) {
        await refreshSession();
      }
    }
  };
  return { redirecting, error, start };
}
