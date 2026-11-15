import { ensureOwnGate } from '../gates/ownGate.ts';
import { EquipmentReportRefusedError } from './EquipmentReportRefusedError.ts';
import { SILENT_AFTER_MILLISECONDS } from './gateHealth.ts';
import type { GateReportSources, HeartbeatCommand } from './recordHeartbeat.ts';

export type TestPassageCommand = HeartbeatCommand;

// The controller's self-test: it must have been heard within the silent window, and it never counts a vehicle or opens a barrier.
export async function recordTestPassage({ gate, requestedGateId }: TestPassageCommand, { reports, clock }: GateReportSources): Promise<Date> {
  ensureOwnGate(gate, requestedGateId);
  const at = clock();
  const heardSince = new Date(at.getTime() - SILENT_AFTER_MILLISECONDS);
  if (!(await reports.recordTestPassage(gate, { at, heardSince }))) {
    throw new EquipmentReportRefusedError('GATE_NOT_HEARD');
  }
  return at;
}
