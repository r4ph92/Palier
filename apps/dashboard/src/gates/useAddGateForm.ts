import type { CreatedGate } from '@palier/shared-types';
import type { GateDraft } from '@palier/shared-types/gateDraft';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useFieldForm, type FieldForm } from '../forms/useFieldForm.ts';
import { GATE_FIELD_OF_CODE, NEW_GATE_VALUES, readGateDraft, type GateFormField } from './gateFormValues.ts';

export interface AddGateTarget {
  readonly lotId: string;
  readonly onAdded: (created: CreatedGate, gateName: string) => void;
}

export interface AddGateForm extends FieldForm<GateFormField> {
  // An entry gate identifies no vehicle: switching to it clears the hidden exit identification.
  readonly chooseKind: (kind: string) => void;
}

export function useAddGateForm({ lotId, onAdded }: AddGateTarget): AddGateForm {
  const send = async (draft: GateDraft) => onAdded(await dashboardClient.addGate(lotId, draft), draft.name);
  const form = useFieldForm({ initialValues: NEW_GATE_VALUES, read: readGateDraft, send, fieldOfCode: GATE_FIELD_OF_CODE, emptiesOnSuccess: true });
  const chooseKind = (kind: string) => {
    form.setValue('kind', kind);
    if (kind !== 'EXIT') {
      form.setValue('exitIdentification', 'NONE');
    }
  };
  return { ...form, chooseKind };
}
