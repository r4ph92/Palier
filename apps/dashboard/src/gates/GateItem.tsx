import type { DashboardGate, DashboardLotGates } from '@palier/shared-types';
import { useState } from 'react';
import type { Refusal, StaleDataFollowUps } from '../api/followUpRefusal.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { useFocusAfterRender } from '../lotMap/useFocusAfterRender.ts';
import { EditGateForm } from './EditGateForm.tsx';
import { editGateButtonId, GateActions } from './GateActions.tsx';
import { GateFacts } from './GateFacts.tsx';
import { changeOfGate, refusedNotice, type GateNotice, type ShownNotice } from './gateNotice.ts';
import { GateChangeLine } from './GateNoticeLine.tsx';
import { useGateSecrets, type ShownKey } from './useGateSecrets.ts';

export interface GateItemContext {
  readonly lotId: string;
  readonly lotName: string;
  readonly onSaved: (lotGates: DashboardLotGates) => void;
  readonly onKey: (shown: ShownKey) => void;
  readonly onNotice: (notice: GateNotice) => void;
  readonly staleData: StaleDataFollowUps;
}

interface GateItemProps {
  readonly gate: DashboardGate;
  readonly context: GateItemContext;
  readonly notice: ShownNotice;
}

// A gate's settings, then either its actions or its edit form, then what was just done to it; focus goes back to the edit
// button when the form closes.
export function GateItem({ gate, context, notice }: GateItemProps) {
  const secrets = useGateSecrets({ ...context, gate });
  const editing = useGateEditing(gate, context);
  return (
    <li className="row gate-item">
      <GateName gate={gate} />
      <GateFacts gate={gate} />
      {editing.isOpen ? (
        <EditGateForm lotId={context.lotId} gate={gate} onSaved={editing.saved} onGone={editing.gone} staleData={context.staleData} onCancel={editing.cancel} />
      ) : (
        <GateActions gate={gate} secrets={secrets} onEdit={editing.open} />
      )}
      <GateChangeLine change={changeOfGate(notice, gate.id)} changeKey={notice.key} />
    </li>
  );
}

function GateName({ gate }: { readonly gate: DashboardGate }) {
  const text = useText();
  return (
    <h3 className="gate-name">
      {gate.name} <span className="gate-kind">{text.equipment.kinds[gate.kind]}</span>
    </h3>
  );
}

function useGateEditing(gate: DashboardGate, { onSaved, onNotice }: GateItemContext) {
  const [isOpen, setIsOpen] = useState(false);
  const focusAfterRender = useFocusAfterRender();
  const cancel = () => {
    setIsOpen(false);
    focusAfterRender(editGateButtonId(gate));
  };
  const saved = (lotGates: DashboardLotGates) => {
    onSaved(lotGates);
    onNotice({ kind: 'saved', gateId: gate.id, gateName: gate.name });
    cancel();
  };
  const gone = (refusal: Refusal) => {
    setIsOpen(false);
    onNotice(refusedNotice(refusal));
  };
  return { isOpen, open: () => setIsOpen(true), cancel, saved, gone };
}
