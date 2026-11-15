import { BATTERY_PERCENT_LIMITS } from '@palier/shared-types/beaconBattery';
import { SILENT_GATE_AFTER_MINUTES } from '@palier/shared-types/gates';

export type EquipmentReportRefusalReason = 'BEACON_NOT_FOUND' | 'BATTERY_PERCENT_INVALID' | 'GATE_NOT_HEARD';

const MESSAGES: Record<EquipmentReportRefusalReason, string> = {
  BEACON_NOT_FOUND: 'This lot has no beacon with this minor.',
  BATTERY_PERCENT_INVALID: `percent must be a whole number from ${BATTERY_PERCENT_LIMITS.minimum} to ${BATTERY_PERCENT_LIMITS.maximum}.`,
  GATE_NOT_HEARD: `The gate sent no heartbeat in the last ${SILENT_GATE_AFTER_MINUTES} minutes: send one, then the test passage again.`,
};

export class EquipmentReportRefusedError extends Error {
  readonly reason: EquipmentReportRefusalReason;

  constructor(reason: EquipmentReportRefusalReason) {
    super(MESSAGES[reason]);
    this.name = 'EquipmentReportRefusedError';
    this.reason = reason;
  }
}
