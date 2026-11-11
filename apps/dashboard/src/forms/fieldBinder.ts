import type { TextFieldProps } from './TextField.tsx';
import type { FieldForm } from './useFieldForm.ts';

export type BoundField = Pick<TextFieldProps, 'id' | 'value' | 'onChange' | 'error' | 'messageValues'>;

// What every TextField of a form takes from the form's state; the page adds the label, the hint and the input kind.
export function fieldBinder<Field extends string>(form: FieldForm<Field>, idPrefix: string, messageValues: Readonly<Record<string, string>>) {
  return (name: Field): BoundField => ({
    id: `${idPrefix}-${name}`,
    value: form.values[name],
    onChange: (value: string) => form.setValue(name, value),
    error: form.errors[name],
    messageValues,
  });
}
