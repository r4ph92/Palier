import { useState } from 'react';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { ErrorNotice } from './ErrorNotice.tsx';

export interface RetryableFailureProps {
  readonly code: DisplayedErrorCode;
  readonly onRetry: () => void;
  readonly isRetrying: boolean;
}

export function RetryableFailure({ code, onRetry, isRetrying }: RetryableFailureProps) {
  const text = useText();
  const [hasRetried, setHasRetried] = useState(false);
  const retry = () => {
    if (isRetrying) {
      return;
    }
    setHasRetried(true);
    onRetry();
  };
  return (
    <>
      <ErrorNotice code={code} takesFocus={hasRetried && !isRetrying} />
      <button type="button" className="text-button" onClick={retry} aria-disabled={isRetrying} aria-busy={isRetrying}>
        {text.failure.retry}
      </button>
    </>
  );
}
