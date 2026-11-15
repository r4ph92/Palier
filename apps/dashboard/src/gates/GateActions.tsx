import type { DashboardGate } from '@palier/shared-types';
import { StableLabel } from '../components/StableLabel.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { closesOnEscape } from '../lotMap/closesOnEscape.ts';
import { useFocusWhen } from '../lotMap/useFocusWhen.ts';
import type { GateSecrets, SecretKind } from './useGateSecrets.ts';

interface GateActionsProps {
  readonly gate: DashboardGate;
  readonly secrets: GateSecrets;
  readonly onEdit: () => void;
}

export function editGateButtonId(gate: DashboardGate): string {
  return `gate-${gate.id}-edit`;
}

// Text buttons only: the page's one filled button adds a gate. A regeneration asks first, in place of these buttons.
export function GateActions({ gate, secrets, onEdit }: GateActionsProps) {
  if (secrets.confirming !== null) {
    return <ReplaceConfirmation gate={gate} secrets={secrets} kind={secrets.confirming} />;
  }
  return <GateButtons gate={gate} secrets={secrets} onEdit={onEdit} />;
}

function GateButtons({ gate, secrets, onEdit }: GateActionsProps) {
  const { gates: text } = useText();
  const printRef = useFocusWhen<HTMLButtonElement>(secrets.refocus === 'print');
  const values = { gate: gate.name };
  return (
    <p className="row-actions gate-actions" aria-busy={secrets.busy}>
      <button type="button" id={editGateButtonId(gate)} className="text-button" aria-label={interpolate(text.edit.name, values)} onClick={onEdit}>
        {text.edit.shown}
      </button>
      <button type="button" ref={printRef} className="text-button" aria-label={interpolate(text.printQr.name, values)} aria-disabled={secrets.busy} onClick={() => void secrets.print()}>
        <StableLabel shown={secrets.busy ? text.preparingQr : text.printQr.shown} reserved={[text.printQr.shown, text.preparingQr]} />
      </button>
      <ReplaceButton gate={gate} secrets={secrets} kind="deviceKey" />
      <ReplaceButton gate={gate} secrets={secrets} kind="qrSecret" />
    </p>
  );
}

// Focus comes back here when its question is cancelled.
function ReplaceButton({ gate, secrets, kind }: ReplaceConfirmationProps) {
  const { gates: text } = useText();
  const buttonRef = useFocusWhen<HTMLButtonElement>(secrets.refocus === kind);
  const action = kind === 'deviceKey' ? text.replaceKey : text.replaceQr;
  return (
    <button type="button" ref={buttonRef} className="text-button" aria-label={interpolate(action.name, { gate: gate.name })} onClick={() => secrets.ask(kind)}>
      {action.shown}
    </button>
  );
}

interface ReplaceConfirmationProps {
  readonly gate: DashboardGate;
  readonly secrets: GateSecrets;
  readonly kind: SecretKind;
}

// The confirm button takes focus as the question opens; Escape cancels like the cancel button.
function ReplaceConfirmation({ gate, secrets, kind }: ReplaceConfirmationProps) {
  const { gates: text } = useText();
  const confirmRef = useFocusWhen<HTMLButtonElement>(true);
  const action = kind === 'deviceKey' ? text.replaceKey : text.replaceQr;
  return (
    <p className="row-actions gate-question" onKeyDown={(event) => closesOnEscape(event, secrets.cancel)}>
      <span>{kind === 'deviceKey' ? text.replaceKeyQuestion : text.replaceQrQuestion}</span>
      <button type="button" ref={confirmRef} className="text-button" aria-label={interpolate(action.name, { gate: gate.name })} aria-disabled={secrets.busy} onClick={() => void secrets.confirm()}>
        <StableLabel shown={secrets.busy ? text.replacing : text.confirmReplace} reserved={[text.confirmReplace, text.replacing]} />
      </button>
      <button type="button" className="text-button" onClick={secrets.cancel}>
        {text.cancel}
      </button>
    </p>
  );
}
