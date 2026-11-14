import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { useMapLimitValues } from './useMapLimitValues.ts';
import { useRecordBatteryForm, type RecordBatteryTarget } from './useRecordBatteryForm.ts';

interface RecordBatteryFormProps extends RecordBatteryTarget {
  readonly aisleName: string;
}

// One per beacon row; its submit is outlined, since the page's filled button belongs to the level form.
export function RecordBatteryForm({ aisleName, ...target }: RecordBatteryFormProps) {
  const text = useText();
  const form = useRecordBatteryForm(target);
  const limits = useMapLimitValues();
  const field = fieldBinder(form, `battery-${target.aisleId}`, limits);
  const names = { aisle: aisleName };
  return (
    <form className="row-form" noValidate aria-busy={form.submitting} onSubmit={(event) => void form.submit(event)}>
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={limits} takesFocus />}
      <TextField {...field('percent')} label={interpolate(text.map.percentLabel, names)} inputMode="numeric" hidesLabel />
      <SubmitButton
        label={text.map.recordBattery.shown}
        busyLabel={text.map.recordingBattery}
        busy={form.submitting}
        emphasis="secondary"
        accessibleName={interpolate(text.map.recordBattery.name, names)}
      />
    </form>
  );
}
