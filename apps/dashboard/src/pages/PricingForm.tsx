import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { clearingOnEachChange, useSavedNotice } from '../forms/useSavedNotice.ts';
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
      <p role="status">{saved.hasSaved && form.summary === null ? <StateMark tone="free" label={text.pricing.saved} wraps /> : null}</p>
    </form>
  );
}
