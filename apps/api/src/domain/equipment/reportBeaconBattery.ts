import { beaconBatteryErrors } from '@palier/shared-types/beaconBattery';
import { AISLE_MINOR_LIMITS } from '@palier/shared-types/beacons';
import type { AuthenticatedGate } from '../gates/AuthenticatedGate.ts';
import { ensureOwnGate } from '../gates/ownGate.ts';
import { EquipmentReportRefusedError } from './EquipmentReportRefusedError.ts';
import type { GateReportSources } from './recordHeartbeat.ts';

export interface BatteryReportCommand {
  readonly gate: AuthenticatedGate;
  readonly requestedGateId: string;
  readonly beaconMinor: number;
  readonly percent: number;
}

// A controller relays the battery of a beacon of its own lot; the latest reading wins, stamped by the server's clock.
export async function reportBeaconBattery(command: BatteryReportCommand, { reports, clock }: GateReportSources): Promise<void> {
  const { gate, beaconMinor, percent } = command;
  ensureOwnGate(gate, command.requestedGateId);
  if (beaconBatteryErrors({ percent }).percent !== undefined) {
    throw new EquipmentReportRefusedError('BATTERY_PERCENT_INVALID');
  }
  // The path pattern lets through only whole numbers from 0; above the highest minor no beacon can exist, so nothing is read.
  if (beaconMinor > AISLE_MINOR_LIMITS.maximum) {
    throw new EquipmentReportRefusedError('BEACON_NOT_FOUND');
  }
  if (!(await reports.recordBeaconBattery({ lotId: gate.lotId, beaconMinor, percent, reportedAt: clock() }))) {
    throw new EquipmentReportRefusedError('BEACON_NOT_FOUND');
  }
}
