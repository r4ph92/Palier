import type { AuthenticatedGate } from '../gates/AuthenticatedGate.ts';
import { ensureOwnGate } from '../gates/passageRules.ts';
import type { Clock } from '../time/Clock.ts';
import type { EquipmentReports } from './EquipmentReports.ts';

export interface GateReportSources {
  readonly reports: EquipmentReports;
  readonly clock: Clock;
}

export interface HeartbeatCommand {
  readonly gate: AuthenticatedGate;
  readonly requestedGateId: string;
}

// Stamped by the server's clock, never the controller's, so a drifting controller cannot look alive or silent.
export async function recordHeartbeat({ gate, requestedGateId }: HeartbeatCommand, { reports, clock }: GateReportSources): Promise<void> {
  ensureOwnGate(gate, requestedGateId);
  await reports.recordHeartbeat(gate, clock());
}
