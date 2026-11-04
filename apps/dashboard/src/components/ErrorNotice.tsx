import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useText } from '../i18n/LanguageContext.tsx';

interface ErrorNoticeProps {
  readonly code: DisplayedErrorCode;
  readonly id?: string;
}

export function ErrorNotice({ code, id }: ErrorNoticeProps) {
  const text = useText();
  return (
    <p id={id} role="alert" className="error-notice">
      {text.errors[code]}
    </p>
  );
}
