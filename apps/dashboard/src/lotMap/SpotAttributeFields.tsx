import type { BoundField } from '../forms/fieldBinder.ts';
import { TextField } from '../forms/TextField.tsx';
import type { Dictionary } from '../i18n/fr.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { CHECKED, SPOT_FLAGS, type SpotAttributeField, type SpotFlag } from './spotFormValues.ts';

interface SpotAttributeFieldsProps {
  readonly field: (name: SpotAttributeField) => BoundField;
  readonly hint?: string | undefined;
}

// The three attributes as boxes to tick under one legend, then the distance to the exit.
export function SpotAttributeFields({ field, hint }: SpotAttributeFieldsProps) {
  const text = useText();
  return (
    <>
      <FlagFields field={field} hint={hint} />
      <TextField {...field('distanceToExit')} label={text.map.spots.distanceLabel} hint={text.map.spots.distanceHint} inputMode="numeric" />
    </>
  );
}

function FlagFields({ field, hint }: SpotAttributeFieldsProps) {
  const text = useText();
  const hintId = `${field('isEv').id}-legend-hint`;
  const labels = flagLabelsOf(text.map.spots);
  return (
    <fieldset className="fieldset" aria-describedby={hint === undefined ? undefined : hintId}>
        <legend className="field-label">{text.map.spots.attributesLegend}</legend>
        {hint === undefined ? null : (
          <p id={hintId} className="field-hint">
            {hint}
          </p>
        )}
        {SPOT_FLAGS.map((flag) => (
          <CheckboxField key={flag} field={field(flag)} label={labels[flag]} />
        ))}
    </fieldset>
  );
}

function CheckboxField({ field, label }: { readonly field: BoundField; readonly label: string }) {
  return (
    <div className="check-field">
      <input id={field.id} type="checkbox" checked={field.value === CHECKED} onChange={(event) => field.onChange(event.target.checked ? CHECKED : '')} />
      <label htmlFor={field.id}>{label}</label>
    </div>
  );
}

export function flagLabelsOf(spots: Dictionary['map']['spots']): Readonly<Record<SpotFlag, string>> {
  return { isEv: spots.electric, isAccessible: spots.accessible, isOversize: spots.oversize };
}
