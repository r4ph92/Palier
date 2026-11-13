import { useState } from 'react';
import { useFieldForm, type FieldForm, type FieldFormSetup } from './useFieldForm.ts';

// Empties every field once a send succeeds, during the render that sees it, so the form is ready for the next entry.
// Focus stays on the submit button, which keeps it while the request is on its way.
export function useResettingFieldForm<Field extends string, Value>(setup: FieldFormSetup<Field, Value>): FieldForm<Field> {
  const [sentCount, setSentCount] = useState(0);
  const [clearedCount, setClearedCount] = useState(0);
  const send = async (value: Value) => {
    await setup.send(value);
    setSentCount((previous) => previous + 1);
  };
  const form = useFieldForm({ ...setup, send });
  if (clearedCount !== sentCount) {
    setClearedCount(sentCount);
    for (const field of Object.keys(setup.initialValues) as Field[]) {
      form.setValue(field, setup.initialValues[field]);
    }
  }
  return form;
}
