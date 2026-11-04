import type { KycStatus } from '@palier/shared-types';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StableLabel } from '../components/StableLabel.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { useStripeOnboarding } from './useStripeOnboarding.ts';

interface StripeConnectButtonProps {
  readonly operatorId: string;
  readonly kycStatus: KycStatus;
}

// Verified needs nothing more. Every other status goes back to Stripe's hosted onboarding: it starts it, or resumes it where it stopped.
export function StripeConnectButton({ operatorId, kycStatus }: StripeConnectButtonProps) {
  const text = useText();
  const onboarding = useStripeOnboarding(operatorId);
  if (kycStatus === 'VERIFIED') {
    return null;
  }
  const label = kycStatus === 'NOT_STARTED' ? text.home.connectStripe : text.home.resumeStripe;
  return (
    <>
      {onboarding.error === null ? null : <ErrorNotice code={onboarding.error} takesFocus />}
      <button type="button" className="primary-button" aria-disabled={onboarding.redirecting} onClick={() => void onboarding.start()}>
        <StableLabel shown={onboarding.redirecting ? text.home.redirecting : label} widest={text.home.resumeStripe} />
      </button>
    </>
  );
}
