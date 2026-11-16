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
  readonly messageValues: Readonly<Record<string, string>>;
  readonly inputMode?: 'decimal' | 'numeric' | 'text' | 'url';
  // A date field gives the browser's calendar, and its value is always YYYY-MM-DD whatever the language.
  readonly type?: 'text' | 'date';
  readonly autoComplete?: string;
  // In a table row the column header shows what to type; the label still names the field for a screen reader.
  readonly hidesLabel?: boolean;
}

export function TextField({ id, label, hint, value, onChange, error, messageValues, inputMode = 'text', type = 'text', autoComplete = 'off', hidesLabel = false }: TextFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id} className={hidesLabel ? 'visually-hidden' : 'field-label'}>{label}</label>
      <input
        id={id}
        className="field-input"
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedByOf({ id, hint, error })}
        aria-invalid={error !== undefined}
      />
      <FieldNotes id={id} hint={hint} error={error} messageValues={messageValues} />
    </div>
  );
}

interface FieldNotesProps {
  readonly id: string;
  readonly hint: string | undefined;
  readonly error: DisplayedErrorCode | undefined;
  readonly messageValues: Readonly<Record<string, string>>;
}

export function describedByOf({ id, hint, error }: Omit<FieldNotesProps, 'messageValues'>): string | undefined {
  const parts = [hint === undefined ? null : `${id}-hint`, error === undefined ? null : `${id}-error`].filter((part) => part !== null);
  return parts.length === 0 ? undefined : parts.join(' ');
}

// The hint and the error under a field, each tied to its input by describedByOf.
export function FieldNotes({ id, hint, error, messageValues }: FieldNotesProps) {
  return (
    <>
      {hint === undefined ? null : <p id={`${id}-hint`} className="field-hint">{interpolate(hint, messageValues)}</p>}
      {error === undefined ? null : <FieldError id={`${id}-error`} code={error} messageValues={messageValues} />}
    </>
  );
}

interface FieldErrorProps {
  readonly id: string;
  readonly code: DisplayedErrorCode;
  readonly messageValues: Readonly<Record<string, string>>;
}

// Plain text tied to its input, not an alert: the form's summary is the one alert, so a screen reader hears it once.
function FieldError({ id, code, messageValues }: FieldErrorProps) {
  const text = useText();
  return (
    <p id={id} className="error-notice">
      {interpolate(text.errors[code], messageValues)}
    </p>
  );
}
