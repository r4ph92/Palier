import { useState } from 'react';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { useLimitValues } from '../lotSetup/useLimitValues.ts';
import { usePricingForm, type PricingFormTarget } from '../lotSetup/usePricingForm.ts';

export function PricingForm({ lotId, pricing, onSaved }: PricingFormTarget) {
  const text = useText();
  const saved = useSavedNotice(onSaved);
  const form = usePricingForm({ lotId, pricing, onSaved: saved.markSaved });
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

// The status stays empty until the first save, so a screen reader announces the confirmation when it appears.
function useSavedNotice(onSaved: () => void) {
  const [hasSaved, setHasSaved] = useState(false);
  const markSaved = () => {
    setHasSaved(true);
    onSaved();
  };
  return { hasSaved, markSaved };
}
