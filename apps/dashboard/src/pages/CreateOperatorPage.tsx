import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { LEGAL_NAME_LIMITS } from '../i18n/legalNameLimits.ts';
import { useCreateOperatorForm } from './useCreateOperatorForm.ts';

interface CreateOperatorPageProps {
  readonly firstName: string;
  readonly onCreated: () => Promise<void>;
}

export function CreateOperatorPage({ firstName, onCreated }: CreateOperatorPageProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.createOperator.eyebrow} title={text.createOperator.title} />
      <p className="lead">
        {interpolate(text.createOperator.greeting, { firstName })} {text.createOperator.intro}
      </p>
      <CreateOperatorForm onCreated={onCreated} />
    </>
  );
}

function CreateOperatorForm({ onCreated }: Pick<CreateOperatorPageProps, 'onCreated'>) {
  const text = useText();
  const form = useCreateOperatorForm(onCreated);
  return (
    <form className="form" noValidate aria-busy={form.submitting} onSubmit={(event) => void form.submit(event)}>
      <LegalNameField
        value={form.values.legalName}
        onChange={(value) => form.setValue('legalName', value)}
        error={form.errors.legalName ?? form.summary}
        attempt={form.attempt}
      />
      <SubmitButton label={text.createOperator.submit} busyLabel={text.createOperator.submitting} busy={form.submitting} />
    </form>
  );
}

interface LegalNameFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  // The form's only field: its own error, or the API's refusal, is the one alert.
  readonly error: DisplayedErrorCode | null;
  readonly attempt: number;
}

function LegalNameField({ value, onChange, error, attempt }: LegalNameFieldProps) {
  const text = useText();
  return (
    <>
      <label htmlFor="legal-name" className="field-label">{text.createOperator.legalNameLabel}</label>
      <input
        id="legal-name"
        className="field-input"
        autoComplete="organization"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={error === null ? 'legal-name-hint' : 'legal-name-hint legal-name-error'}
        aria-invalid={error !== null}
      />
      <p id="legal-name-hint" className="field-hint">{interpolate(text.createOperator.legalNameHint, LEGAL_NAME_LIMITS)}</p>
      {error === null ? null : <ErrorNotice key={attempt} id="legal-name-error" code={error} values={LEGAL_NAME_LIMITS} takesFocus />}
    </>
  );
}
