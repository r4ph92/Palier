import { useState, type FormEvent } from 'react';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import type { FieldForm } from '../forms/useFieldForm.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { useLimitValues } from '../lotSetup/useLimitValues.ts';
import { usePricingForm, type PricingFormTarget } from '../lotSetup/usePricingForm.ts';

export function PricingForm({ lotId, pricing, onSaved }: PricingFormTarget) {
  const text = useText();
  const saved = useSavedNotice(onSaved);
  const form = clearingOnEachChange(usePricingForm({ lotId, pricing, onSaved: saved.markSaved }), saved.clear);
  const field = fieldBinder(form, 'pricing', useLimitValues());
  return (
    <form className="form" noValidate aria-busy={form.submitting} onSubmit={(event) => void form.submit(event)}>
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} takesFocus />}
      <TextField {...field('incrementCents')} label={text.pricing.incrementCentsLabel} hint={text.pricing.incrementCentsHint} inputMode="decimal" />
      <TextField {...field('incrementMinutes')} label={text.pricing.incrementMinutesLabel} hint={text.pricing.incrementMinutesHint} inputMode="numeric" />
      <TextField {...field('dailyCapCents')} label={text.pricing.dailyCapLabel} hint={text.pricing.dailyCapHint} inputMode="decimal" />
      <TextField {...field('holdQuota')} label={text.pricing.holdQuotaLabel} hint={text.pricing.holdQuotaHint} inputMode="numeric" />
      <SubmitButton label={text.pricing.submit} busyLabel={text.pricing.submitting} busy={form.submitting} />
      <p role="status" className="muted">
        {saved.hasSaved && form.summary === null ? text.pricing.saved : ''}
      </p>
    </form>
  );
}

// The status empties on each edit and each submit, so a screen reader announces the confirmation every time it comes back.
function useSavedNotice(onSaved: () => void) {
  const [hasSaved, setHasSaved] = useState(false);
  const markSaved = () => {
    setHasSaved(true);
    onSaved();
  };
  return { hasSaved, markSaved, clear: () => setHasSaved(false) };
}

function clearingOnEachChange<Field extends string>(form: FieldForm<Field>, clear: () => void): FieldForm<Field> {
  const setValue = (field: Field, value: string) => {
    clear();
    form.setValue(field, value);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    clear();
    return form.submit(event);
  };
  return { ...form, setValue, submit };
}
