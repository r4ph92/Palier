import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { StableLabel } from '../components/StableLabel.tsx';
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
      <LegalNameField value={form.legalName} onChange={form.setLegalName} error={form.error} />
      <button type="submit" className="primary-button" aria-disabled={form.submitting}>
        <StableLabel shown={form.submitting ? text.createOperator.submitting : text.createOperator.submit} widest={text.createOperator.submit} />
      </button>
    </form>
  );
}

interface LegalNameFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: DisplayedErrorCode | null;
}

function LegalNameField({ value, onChange, error }: LegalNameFieldProps) {
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
      {error === null ? null : <ErrorNotice id="legal-name-error" code={error} values={LEGAL_NAME_LIMITS} takesFocus />}
    </>
  );
}
