import type { DashboardGate } from '@palier/shared-types';
import {
  endpointOf,
  EXIT_IDENTIFICATIONS,
  GATE_INTEGRATION_KINDS,
  gateDraftErrors,
  type ExitIdentification,
  type GateDraft,
  type GateIntegrationKind,
  type GateSettings,
} from '@palier/shared-types/gateDraft';
import { canonicalNameOf } from '@palier/shared-types/displayText';
import { GATE_KINDS } from '@palier/shared-types/gates';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { CHECKED } from '../forms/CheckboxField.tsx';
import { readFormOf, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';

export type GateFormField = 'name' | 'kind' | 'integrationKind' | 'endpoint' | 'reportsLoops' | 'exitIdentification';

// A new gate starts as an entry on a dry contact that reports its loops: what most garages install.
export const NEW_GATE_VALUES: FieldValues<GateFormField> = {
  name: '',
  kind: 'ENTRY',
  integrationKind: 'DRY_CONTACT',
  endpoint: '',
  reportsLoops: CHECKED,
  exitIdentification: 'NONE',
};

export const GATE_FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, GateFormField>>> = {
  GATE_NAME_REQUIRED: 'name',
  GATE_NAME_INVALID: 'name',
  GATE_NAME_TAKEN: 'name',
  GATE_ENDPOINT_NOT_HTTPS: 'endpoint',
  GATE_ENDPOINT_REQUIRED: 'endpoint',
  GATE_EXIT_ID_ON_ENTRY: 'exitIdentification',
};

export function gateValuesOf(gate: DashboardGate): FieldValues<GateFormField> {
  const { name, kind, integrationKind, endpoint, reportsLoops, exitIdentification } = gate;
  return { name, kind, integrationKind, endpoint: endpoint ?? '', reportsLoops: reportsLoops ? CHECKED : '', exitIdentification };
}

export function isExitForm(values: FieldValues<GateFormField>): boolean {
  return values.kind === 'EXIT';
}

// The shared rule, the same the API runs; an entry gate's hidden exit identification is never sent.
export function readGateDraft(values: FieldValues<GateFormField>): ReadForm<GateFormField, GateDraft> {
  const draft = draftOf(values);
  return readFormOf(draft, gateDraftErrors(draft));
}

export function readGateSettings(values: FieldValues<GateFormField>): ReadForm<GateFormField, GateSettings> {
  const read = readGateDraft(values);
  return read.ok ? { ok: true, value: settingsOf(read.value) } : read;
}

function draftOf(values: FieldValues<GateFormField>): GateDraft {
  const kind = oneOf(GATE_KINDS, values.kind);
  return {
    name: canonicalNameOf(values.name),
    kind,
    integrationKind: oneOf<GateIntegrationKind>(GATE_INTEGRATION_KINDS, values.integrationKind),
    endpoint: endpointOf(values.endpoint),
    reportsLoops: values.reportsLoops === CHECKED,
    exitIdentification: kind === 'EXIT' ? oneOf<ExitIdentification>(EXIT_IDENTIFICATIONS, values.exitIdentification) : 'NONE',
  };
}

function settingsOf({ name, integrationKind, endpoint, reportsLoops, exitIdentification }: GateDraft): GateSettings {
  return { name, integrationKind, endpoint, reportsLoops, exitIdentification };
}

// A select only offers known values; the first one stands in for anything else.
function oneOf<Value extends string>(values: readonly Value[], value: string): Value {
  return values.find((known) => known === value) ?? (values[0] as Value);
}
