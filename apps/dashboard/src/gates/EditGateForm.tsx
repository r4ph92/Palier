import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { fieldBinder } from '../forms/fieldBinder.ts';
import { SubmitButton } from '../forms/SubmitButton.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { closesOnEscape } from '../lotMap/closesOnEscape.ts';
import { useFocusWhen } from '../lotMap/useFocusWhen.ts';
import { GateFields } from './GateFields.tsx';
import { isExitForm } from './gateFormValues.ts';
import { useEditGateForm, type EditGateTarget } from './useEditGateForm.ts';
import { useGateLimitValues } from './useGateLimitValues.ts';

interface EditGateFormProps extends EditGateTarget {
  readonly onCancel: () => void;
}

// Opened from the gate: focus lands on its title. The direction is set once, so it is not offered here.
export function EditGateForm({ onCancel, ...target }: EditGateFormProps) {
  const form = useEditGateForm(target);
  const limits = useGateLimitValues();
  const field = fieldBinder(form, `gate-${target.gate.id}`, { ...limits, ...form.refusalValues });
  return (
    <form className="form gate-edit-form" noValidate aria-busy={form.submitting} aria-labelledby={editTitleIdOf(target.gate.id)} onSubmit={(event) => void form.submit(event)} onKeyDown={(event) => closesOnEscape(event, onCancel)}>
      <EditGateTitle gateId={target.gate.id} gateName={target.gate.name} />
      {form.summary === null ? null : <ErrorNotice key={form.attempt} code={form.summary} values={limits} takesFocus />}
      <GateFields field={field} isExit={isExitForm(form.values)} />
      <EditGateActions submitting={form.submitting} onCancel={onCancel} />
    </form>
  );
}

function editTitleIdOf(gateId: string): string {
  return `gate-${gateId}-edit-title`;
}

function EditGateTitle({ gateId, gateName }: { readonly gateId: string; readonly gateName: string }) {
  const { gates: text } = useText();
  const titleRef = useFocusWhen<HTMLHeadingElement>(true);
  return (
    <h4 id={editTitleIdOf(gateId)} ref={titleRef} tabIndex={-1} className="subsection-title">
      {interpolate(text.editTitle, { gate: gateName })}
    </h4>
  );
}

function EditGateActions({ submitting, onCancel }: { readonly submitting: boolean; readonly onCancel: () => void }) {
  const { gates: text } = useText();
  return (
    <div className="actions-row">
      <SubmitButton label={text.save} busyLabel={text.saving} busy={submitting} emphasis="secondary" />
      <button type="button" className="text-button" onClick={onCancel}>
        {text.cancel}
      </button>
    </div>
  );
}
