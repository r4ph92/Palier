import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton, type ButtonEmphasis } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { useAddLevelForm, type AddLevelTarget } from './useAddLevelForm.ts';
import { useMapLimitValues } from './useMapLimitValues.ts';

interface AddLevelFormProps extends AddLevelTarget {
  readonly emphasis: ButtonEmphasis;
}

export function AddLevelForm({ emphasis, ...target }: AddLevelFormProps) {
  const text = useText();
  const form = useAddLevelForm(target);
  const limits = useMapLimitValues();
  const field = fieldBinder(form, 'level', limits);
  return (
    <form className="form" noValidate aria-busy={form.submitting} onSubmit={(event) => void form.submit(event)}>
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={limits} takesFocus />}
      <TextField {...field('code')} label={text.map.levelCodeLabel} hint={text.map.levelCodeHint} />
      <SubmitButton label={text.map.addLevel} busyLabel={text.map.addingLevel} busy={form.submitting} emphasis={emphasis} />
    </form>
  );
}
