import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { closesOnEscape } from './closesOnEscape.ts';
import { SpotAttributeFields } from './SpotAttributeFields.tsx';
import { useFocusWhen } from './useFocusWhen.ts';
import { useEditSpotForm, type EditSpotTarget } from './useEditSpotForm.ts';
import { useMapLimitValues } from './useMapLimitValues.ts';

interface EditSpotFormProps extends EditSpotTarget {
  readonly onCancel: () => void;
}

// Opened from a row: focus lands on its title, so a keyboard user starts from the form they asked for.
export function EditSpotForm({ onCancel, ...target }: EditSpotFormProps) {
  const form = useEditSpotForm(target);
  const limits = useMapLimitValues();
  const field = fieldBinder(form, `spot-${target.spot.id}`, limits);
  return (
    <form
      className="form spot-edit-form"
      noValidate
      aria-busy={form.submitting}
      aria-labelledby="edit-spot-title"
      onSubmit={(event) => void form.submit(event)}
      onKeyDown={(event) => closesOnEscape(event, onCancel)}
    >
      <EditSpotTitle number={target.spot.number} />
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={limits} takesFocus />}
      <SpotAttributeFields field={field} />
      <EditSpotActions submitting={form.submitting} onCancel={onCancel} />
    </form>
  );
}

function EditSpotTitle({ number }: { readonly number: string }) {
  const text = useText();
  const titleRef = useFocusWhen<HTMLHeadingElement>(true);
  return (
    <h4 id="edit-spot-title" ref={titleRef} tabIndex={-1} className="subsection-title">
      {interpolate(text.map.spots.editTitle, { number })}
    </h4>
  );
}

function EditSpotActions({ submitting, onCancel }: { readonly submitting: boolean; readonly onCancel: () => void }) {
  const { spots: text } = useText().map;
  return (
    <div className="actions-row">
      <SubmitButton label={text.save} busyLabel={text.saving} busy={submitting} emphasis="secondary" />
      <button type="button" className="text-button" onClick={onCancel}>
        {text.cancel}
      </button>
    </div>
  );
}
