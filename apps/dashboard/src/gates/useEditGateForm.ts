import type { DashboardGate, DashboardLotGates } from '@palier/shared-types';
import type { GateSettings } from '@palier/shared-types/gateDraft';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import type { Refusal, StaleDataFollowUps } from '../api/followUpRefusal.ts';
import { useFieldForm, type FieldForm } from '../forms/useFieldForm.ts';
import { GATE_FIELD_OF_CODE, gateValuesOf, readGateSettings, type GateFormField } from './gateFormValues.ts';

export interface EditGateTarget {
  readonly lotId: string;
  readonly gate: DashboardGate;
  readonly onSaved: (lotGates: DashboardLotGates) => void;
  // The gate is gone: the list closes this form and says why.
  readonly onGone: (refusal: Refusal) => void;
  readonly staleData: StaleDataFollowUps;
}

export function useEditGateForm({ lotId, gate, onSaved, onGone, staleData }: EditGateTarget): FieldForm<GateFormField> {
  const send = async (settings: GateSettings) => onSaved(await dashboardClient.changeGate(lotId, gate.id, settings));
  const afterRefusal = (answeredCode: DisplayedErrorCode, refusal: Refusal) => {
    if (answeredCode === 'GATE_NOT_FOUND') {
      onGone(refusal);
    }
  };
  return useFieldForm({ initialValues: gateValuesOf(gate), read: readGateSettings, send, fieldOfCode: GATE_FIELD_OF_CODE, staleData, afterRefusal });
}
