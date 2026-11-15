import type { BoundField } from './fieldBinder.ts';
import { describedByOf, FieldNotes } from './TextField.tsx';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly field: BoundField;
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly hint?: string | undefined;
}

// Prose options, in the body face and as wide as a text input; the level and aisle code pickers keep .field-select.
export function SelectField({ field, label, options, hint }: SelectFieldProps) {
  const { id, value, onChange, error, messageValues } = field;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="field-input" value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={describedByOf({ id, hint, error })} aria-invalid={error !== undefined}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldNotes id={id} hint={hint} error={error} messageValues={messageValues} />
    </div>
  );
}
