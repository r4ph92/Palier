import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { LEGAL_NAME_LIMITS } from '../i18n/legalNameLimits.ts';

interface ErrorNoticeProps {
  readonly code: DisplayedErrorCode;
  readonly id?: string;
}

export function ErrorNotice({ code, id }: ErrorNoticeProps) {
  const text = useText();
  return (
    <p id={id} role="alert" className="error-notice">
      {interpolate(text.errors[code], LEGAL_NAME_LIMITS)}
    </p>
  );
}
