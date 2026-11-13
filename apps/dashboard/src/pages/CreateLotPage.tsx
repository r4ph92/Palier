import { AppLink } from '../components/AppLink.tsx';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { useCreateLotForm } from '../lotSetup/useCreateLotForm.ts';
import { useLimitValues } from '../lotSetup/useLimitValues.ts';
import { HOME_PATH } from '../navigation/routes.ts';

export function CreateLotPage() {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.createLot.eyebrow} title={text.createLot.title} />
      <p className="lead">{text.createLot.intro}</p>
      <CreateLotForm />
      <AppLink href={HOME_PATH} className="text-link">
        {text.lot.back}
      </AppLink>
    </>
  );
}

function CreateLotForm() {
  const text = useText();
  const form = useCreateLotForm();
  const field = fieldBinder(form, 'lot', useLimitValues());
  return (
    <form className="form" noValidate aria-busy={form.submitting} onSubmit={(event) => void form.submit(event)}>
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} takesFocus />}
      <TextField {...field('name')} label={text.createLot.nameLabel} hint={text.createLot.nameHint} autoComplete="organization" />
      <TextField {...field('address')} label={text.createLot.addressLabel} autoComplete="street-address" />
      <fieldset className="fieldset">
        <legend className="eyebrow">{text.createLot.locationLegend}</legend>
        <TextField {...field('latitude')} label={text.createLot.latitudeLabel} hint={text.createLot.latitudeHint} inputMode="decimal" />
        <TextField {...field('longitude')} label={text.createLot.longitudeLabel} hint={text.createLot.longitudeHint} inputMode="decimal" />
      </fieldset>
      <TextField {...field('capacity')} label={text.createLot.capacityLabel} hint={text.createLot.capacityHint} inputMode="numeric" />
      <SubmitButton label={text.createLot.submit} busyLabel={text.createLot.submitting} busy={form.submitting} />
    </form>
  );
}
