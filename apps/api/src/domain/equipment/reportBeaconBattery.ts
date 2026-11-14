import { beaconBatteryErrors } from '@palier/shared-types/beaconBattery';
import { AISLE_MINOR_LIMITS, EXIT_LANE_MINOR } from '@palier/shared-types/beacons';
import { isWholeNumberWithin } from '@palier/shared-types/fieldErrors';
import type { AuthenticatedGate } from '../gates/AuthenticatedGate.ts';
import { ensureOwnGate } from '../gates/passageRules.ts';
import { EquipmentReportRefusedError } from './EquipmentReportRefusedError.ts';
import type { GateReportSources } from './recordHeartbeat.ts';

const BEACON_MINOR_LIMITS = { minimum: EXIT_LANE_MINOR, maximum: AISLE_MINOR_LIMITS.maximum };

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
  if (!isWholeNumberWithin(beaconMinor, BEACON_MINOR_LIMITS)) {
    throw new EquipmentReportRefusedError('BEACON_NOT_FOUND');
  }
  if (!(await reports.recordBeaconBattery({ lotId: gate.lotId, beaconMinor, percent, reportedAt: clock() }))) {
    throw new EquipmentReportRefusedError('BEACON_NOT_FOUND');
  }
}
