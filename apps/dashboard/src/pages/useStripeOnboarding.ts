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

interface OnboardingScreen {
  readonly setRedirecting: (redirecting: boolean) => void;
  readonly setError: (error: DisplayedErrorCode | null) => void;
  readonly refreshSession: () => Promise<void>;
}

// A failure frees the button and shows its code; an ended session is also read again so the shell shows the sign-in page.
async function requestOnboarding(operatorId: string, { setRedirecting, setError, refreshSession }: OnboardingScreen): Promise<void> {
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
}

// On success the page is left for Stripe, so it stays busy.
export function useStripeOnboarding(operatorId: string): StripeOnboarding {
  const refreshSession = useSessionRefresh();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const start = async () => {
    if (!redirecting) {
      await requestOnboarding(operatorId, { setRedirecting, setError, refreshSession });
    }
  };
  return { redirecting, error, start };
}
