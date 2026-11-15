import { GATE_KINDS } from '@palier/shared-types/gates';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder, type BoundField } from '../forms/fieldBinder.ts';
import { SelectField } from '../forms/SelectField.tsx';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { GateFields } from './GateFields.tsx';
import { isExitForm } from './gateFormValues.ts';
import { useAddGateForm, type AddGateTarget } from './useAddGateForm.ts';
import { useGateLimitValues } from './useGateLimitValues.ts';

// The page's one filled button (design.md, move 5).
export function AddGateForm(target: AddGateTarget) {
  const text = useText();
  const form = useAddGateForm(target);
  const limits = useGateLimitValues();
  const field = fieldBinder(form, 'new-gate', { ...limits, ...form.refusalValues });
  const kindField = <KindField field={{ ...field('kind'), onChange: form.chooseKind }} />;
  return (
    <section className="section" aria-labelledby="add-gate-title">
      <h2 id="add-gate-title" className="section-title">
        {text.gates.addTitle}
      </h2>
      <form className="form" noValidate aria-busy={form.submitting} onSubmit={(event) => void form.submit(event)}>
        {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={limits} takesFocus />}
        <GateFields field={field} isExit={isExitForm(form.values)} kindField={kindField} />
        <SubmitButton label={text.gates.add} busyLabel={text.gates.adding} busy={form.submitting} />
      </form>
    </section>
  );
}

function KindField({ field }: { readonly field: BoundField }) {
  const text = useText();
  const options = GATE_KINDS.map((kind) => ({ value: kind, label: text.equipment.kinds[kind] }));
  return <SelectField field={field} label={text.gates.kindLabel} hint={text.gates.exitLimitNote} options={options} />;
}
