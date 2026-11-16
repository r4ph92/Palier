import type { LotPublication } from '@palier/shared-types';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { clearingOnEachChange, useSavedNotice } from '../forms/useSavedNotice.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { attestationMessageValues, useAttestationForm, type AttestationTarget } from './useAttestationForm.ts';

export function AttestationForm(target: AttestationTarget) {
  const { text, language } = useLanguage();
  const words = text.publication;
  const { form, saved } = useSavedAttestationForm(target);
  const prefix = `attestation-${target.kind.toLowerCase()}`;
  const messageValues = attestationMessageValues(language);
  const field = fieldBinder(form, prefix, messageValues);
  return (
    <form className="form" noValidate aria-busy={form.submitting} aria-labelledby={`${prefix}-title`} onSubmit={(event) => void form.submit(event)}>
      <h3 id={`${prefix}-title`} className="subsection-title">
        {target.kind === 'WIFI' ? words.wifiFormTitle : words.cellularFormTitle}
      </h3>
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={messageValues} takesFocus />}
      <TextField {...field('measuredOn')} type="date" label={words.measuredOnLabel} />
      <TextField {...field('note')} label={words.noteLabel} hint={words.noteHint} />
      <SubmitButton label={words.save} busyLabel={words.saving} busy={form.submitting} emphasis="secondary" />
      <p role="status">{saved.hasSaved && form.summary === null ? <StateMark tone="free" label={words.saved} wraps /> : null}</p>
    </form>
  );
}

// The confirmation shows once the page holds what the API saved, and empties on the next edit.
function useSavedAttestationForm(target: AttestationTarget) {
  const saved = useSavedNotice(() => undefined);
  const onSaved = (publication: LotPublication) => {
    target.onSaved(publication);
    saved.markSaved();
  };
  return { form: clearingOnEachChange(useAttestationForm({ ...target, onSaved }), saved.clear), saved };
}
