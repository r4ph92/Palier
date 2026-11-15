import type { DashboardGate, DashboardLotGates, GateKind } from '@palier/shared-types';
import type { ExitIdentification, GateIntegrationKind } from '@palier/shared-types/gateDraft';
import type { ExitIdKind } from '../../domain/gates/AuthenticatedGate.ts';

// The dashboard says plate and transponder; the column keeps the reader's technology (ANPR camera, RFID reader).
export const EXIT_ID_KIND_OF: Readonly<Record<ExitIdentification, ExitIdKind>> = { NONE: 'NONE', PLATE: 'ANPR', TRANSPONDER: 'RFID' };
export const EXIT_IDENTIFICATION_OF: Readonly<Record<ExitIdKind, ExitIdentification>> = { NONE: 'NONE', ANPR: 'PLATE', RFID: 'TRANSPONDER' };

export interface GateSettingsRow extends Record<string, unknown> {
  readonly lot_name: string;
  readonly gate_id: string | null;
  readonly gate_name: string | null;
  readonly gate_kind: GateKind | null;
  readonly integration_kind: GateIntegrationKind | null;
  readonly endpoint: string | null;
  readonly has_loops: boolean | null;
  readonly exit_id_kind: ExitIdKind | null;
}

type GateRow = GateSettingsRow & {
  readonly gate_id: string;
  readonly gate_name: string;
  readonly gate_kind: GateKind;
  readonly integration_kind: GateIntegrationKind;
  readonly has_loops: boolean;
  readonly exit_id_kind: ExitIdKind;
};

export function exitIdKindOf(exitIdentification: ExitIdentification): ExitIdKind {
  return EXIT_ID_KIND_OF[exitIdentification];
}

// Null when no row came back: the lot is not the operator's.
export function lotGatesOf(lotId: string, rows: readonly GateSettingsRow[]): DashboardLotGates | null {
  const [first] = rows;
  if (first === undefined) {
    return null;
  }
  return { lotId, lotName: first.lot_name, gates: rows.filter(isGateRow).map(dashboardGateOf) };
}

function isGateRow(row: GateSettingsRow): row is GateRow {
  return row.gate_id !== null;
}

function dashboardGateOf(row: GateRow): DashboardGate {
  return {
    id: row.gate_id,
    name: row.gate_name,
    kind: row.gate_kind,
    integrationKind: row.integration_kind,
    endpoint: row.endpoint,
    reportsLoops: row.has_loops,
    exitIdentification: EXIT_IDENTIFICATION_OF[row.exit_id_kind],
  };
}
