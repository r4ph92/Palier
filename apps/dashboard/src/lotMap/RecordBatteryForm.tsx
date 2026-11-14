import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { TextField } from '../forms/TextField.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { useBatteryLimitValues } from './useBatteryLimitValues.ts';
import { useRecordBatteryForm, type RecordBatteryTarget } from './useRecordBatteryForm.ts';

interface RecordBatteryFormProps extends RecordBatteryTarget {
  readonly aisleName: string;
}

// One per beacon row; its submit is outlined, since the page's filled button belongs to the level form.
export function RecordBatteryForm({ aisleName, ...target }: RecordBatteryFormProps) {
  const text = useText();
  const form = useRecordBatteryForm(target);
  const limits = useBatteryLimitValues();
  const field = fieldBinder(form, `battery-${target.aisleId}`, limits);
  return (
    <form className="row-form" noValidate aria-busy={form.submitting} onSubmit={(event) => void form.submit(event)}>
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={limits} takesFocus />}
      <div className="row-form-controls">
        <TextField {...field('percent')} label={interpolate(text.map.percentLabel, { aisle: aisleName })} inputMode="numeric" hidesLabel />
        <RecordBatteryButton aisleName={aisleName} busy={form.submitting} />
      </div>
    </form>
  );
}

function RecordBatteryButton({ aisleName, busy }: { readonly aisleName: string; readonly busy: boolean }) {
  const text = useText();
  return (
    <SubmitButton
      label={text.map.recordBattery.shown}
      busyLabel={text.map.recordingBattery}
      busy={busy}
      emphasis="secondary"
      accessibleName={interpolate(text.map.recordBattery.name, { aisle: aisleName })}
    />
  );
}
