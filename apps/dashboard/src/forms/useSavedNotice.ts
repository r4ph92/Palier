import { useState, type FormEvent } from 'react';
import type { FieldForm } from './useFieldForm.ts';

export interface SavedNotice {
  readonly hasSaved: boolean;
  readonly markSaved: () => void;
  readonly clear: () => void;
}

// The status empties on each edit and each submit, so a screen reader announces the confirmation every time it comes back.
export function useSavedNotice(onSaved: () => void): SavedNotice {
  const [hasSaved, setHasSaved] = useState(false);
  const markSaved = () => {
    setHasSaved(true);
    onSaved();
  };
  return { hasSaved, markSaved, clear: () => setHasSaved(false) };
}

export function clearingOnEachChange<Field extends string>(form: FieldForm<Field>, clear: () => void): FieldForm<Field> {
  const setValue = (field: Field, value: string) => {
    clear();
    form.setValue(field, value);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    clear();
    return form.submit(event);
  };
  return { ...form, setValue, submit };
}
