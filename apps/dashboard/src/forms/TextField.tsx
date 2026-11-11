import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { interpolate } from '../i18n/interpolate.ts';

export interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: DisplayedErrorCode | undefined;
  // Fills the limits named in the hint and the error.
  readonly values: Readonly<Record<string, string>>;
  readonly inputMode?: 'decimal' | 'numeric' | 'text';
  readonly autoComplete?: string;
}

export function TextField({ id, label, hint, value, onChange, error, values, inputMode = 'text', autoComplete = 'off' }: TextFieldProps) {
  const describedBy = [hint === undefined ? null : `${id}-hint`, error === undefined ? null : `${id}-error`].filter((part) => part !== null);
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      <input
        id={id}
        className="field-input"
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy.length === 0 ? undefined : describedBy.join(' ')}
        aria-invalid={error !== undefined}
      />
      {hint === undefined ? null : <p id={`${id}-hint`} className="field-hint">{interpolate(hint, values)}</p>}
      {error === undefined ? null : <FieldError id={`${id}-error`} code={error} values={values} />}
    </div>
  );
}

interface FieldErrorProps {
  readonly id: string;
  readonly code: DisplayedErrorCode;
  readonly values: Readonly<Record<string, string>>;
}

// Plain text tied to its input, not an alert: the form's summary is the one alert, so a screen reader hears it once.
function FieldError({ id, code, values }: FieldErrorProps) {
  const text = useText();
  return (
    <p id={id} className="error-notice">
      {interpolate(text.errors[code], values)}
    </p>
  );
}
