import type { BoundField } from './fieldBinder.ts';

// A form keeps every value as text: a ticked box is CHECKED, an unticked one is empty.
export const CHECKED = 'checked';

interface CheckboxFieldProps {
  readonly field: BoundField;
  readonly label: string;
  readonly hint?: string;
}

export function CheckboxField({ field, label, hint }: CheckboxFieldProps) {
  const hintId = `${field.id}-hint`;
  return (
    <div className={hint === undefined ? 'check-field' : 'check-field check-field-with-hint'}>
      <input
        id={field.id}
        type="checkbox"
        checked={field.value === CHECKED}
        aria-describedby={hint === undefined ? undefined : hintId}
        onChange={(event) => field.onChange(event.target.checked ? CHECKED : '')}
      />
      <label htmlFor={field.id}>{label}</label>
      {hint === undefined ? null : (
        <p id={hintId} className="field-hint check-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
