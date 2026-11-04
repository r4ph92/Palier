import { useEffect, useRef } from 'react';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { LEGAL_NAME_LIMITS } from '../i18n/legalNameLimits.ts';

interface ErrorNoticeProps {
  readonly code: DisplayedErrorCode;
  readonly id?: string;
  // After a failed action, focus lands here so a keyboard user continues from the error, not from the top of the page.
  readonly takesFocus?: boolean;
}

export function ErrorNotice({ code, id, takesFocus = false }: ErrorNoticeProps) {
  const text = useText();
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (takesFocus) {
      noticeRef.current?.focus();
    }
  }, [takesFocus]);
  return (
    <p ref={noticeRef} id={id} role="alert" tabIndex={takesFocus ? -1 : undefined} className="error-notice">
      {interpolate(text.errors[code], LEGAL_NAME_LIMITS)}
    </p>
  );
}
