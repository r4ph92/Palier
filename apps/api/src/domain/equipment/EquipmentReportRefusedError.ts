export type EquipmentReportRefusalReason = 'BEACON_NOT_FOUND' | 'BATTERY_PERCENT_INVALID';

const MESSAGES: Record<EquipmentReportRefusalReason, string> = {
  BEACON_NOT_FOUND: 'This lot has no beacon with this minor.',
  BATTERY_PERCENT_INVALID: 'percent must be a whole number from 0 to 100.',
};

export class EquipmentReportRefusedError extends Error {
  readonly reason: EquipmentReportRefusalReason;

  constructor(reason: EquipmentReportRefusalReason) {
    super(MESSAGES[reason]);
    this.name = 'EquipmentReportRefusedError';
    this.reason = reason;
  }
}
