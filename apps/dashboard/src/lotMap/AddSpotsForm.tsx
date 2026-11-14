import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { SpotAttributeFields } from './SpotAttributeFields.tsx';
import { useAddSpotsForm, type AddSpotsTarget } from './useAddSpotsForm.ts';
import { useMapLimitValues } from './useMapLimitValues.ts';

// Outlined: the map page keeps its one filled button for the aisle form (design.md, move 5).
export function AddSpotsForm(target: AddSpotsTarget) {
  const text = useText();
  const form = useAddSpotsForm(target);
  const values = { ...useMapLimitValues(), ...form.refusalValues };
  const field = fieldBinder(form, `spots-${target.aisleId}`, values);
  return (
    <form className="form" noValidate aria-busy={form.submitting} aria-labelledby="add-spots-title" onSubmit={(event) => void form.submit(event)}>
      <h3 id="add-spots-title" className="subsection-title">
        {text.map.spots.addTitle}
      </h3>
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={values} takesFocus />}
      <TextField {...field('range')} label={text.map.spots.rangeLabel} hint={text.map.spots.rangeHint} />
      <SpotAttributeFields field={field} hint={text.map.spots.addAttributesHint} />
      <SubmitButton label={text.map.spots.add} busyLabel={text.map.spots.adding} busy={form.submitting} emphasis="secondary" />
    </form>
  );
}
