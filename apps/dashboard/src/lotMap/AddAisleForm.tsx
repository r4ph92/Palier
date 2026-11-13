import type { DashboardMapLevel } from '@palier/shared-types';
import type { AisleDraftField } from '@palier/shared-types/aisleDraft';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder, type BoundField } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { PlanPreview } from './PlanPreview.tsx';
import { draftRectangleOf, useAddAisleForm, type AddAisleTarget } from './useAddAisleForm.ts';
import { useMapLimitValues } from './useMapLimitValues.ts';

type FieldOf = (name: AisleDraftField) => BoundField;

interface AddAisleFormProps extends Omit<AddAisleTarget, 'levelId'> {
  readonly level: DashboardMapLevel;
}

export function AddAisleForm({ lotId, level, onAdded }: AddAisleFormProps) {
  const text = useText();
  const form = useAddAisleForm({ lotId, levelId: level.id, onAdded });
  const limits = useMapLimitValues();
  const field = fieldBinder(form, `aisle-${level.id}`, limits);
  return (
    <form className="form" noValidate aria-busy={form.submitting} onSubmit={(event) => void form.submit(event)}>
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={limits} takesFocus />}
      <TextField {...field('code')} label={text.map.aisleCodeLabel} hint={text.map.aisleCodeHint} />
      <TextField {...field('beaconMinor')} label={text.map.minorLabel} hint={text.map.minorHint} inputMode="numeric" />
      <RectangleFields field={field} hintId={`aisle-${level.id}-rectangle-hint`} limits={limits} />
      <PlanPreview levelCode={level.code} aisles={level.aisles} draft={draftRectangleOf(form.values)} />
      <SubmitButton label={text.map.addAisle} busyLabel={text.map.addingAisle} busy={form.submitting} />
    </form>
  );
}

interface RectangleFieldsProps {
  readonly field: FieldOf;
  readonly hintId: string;
  readonly limits: Readonly<Record<string, string>>;
}

// x, y, width and height on the level's grid (decision 018); the hint gives the grid's bounds once for the four.
function RectangleFields({ field, hintId, limits }: RectangleFieldsProps) {
  const text = useText();
  return (
    <fieldset className="fieldset" aria-describedby={hintId}>
      <legend className="field-label">{text.map.rectangleLegend}</legend>
      <p id={hintId} className="field-hint">
        {interpolate(text.map.rectangleHint, limits)}
      </p>
      <div className="rectangle-fields">
        <TextField {...field('x')} label={text.map.xLabel} inputMode="numeric" />
        <TextField {...field('y')} label={text.map.yLabel} inputMode="numeric" />
        <TextField {...field('width')} label={text.map.widthLabel} inputMode="numeric" />
        <TextField {...field('height')} label={text.map.heightLabel} inputMode="numeric" />
      </div>
    </fieldset>
  );
}
