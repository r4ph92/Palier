export interface ReportingGate {
  readonly id: string;
  readonly lotId: string;
}

export interface BeaconBatteryReport {
  readonly lotId: string;
  readonly beaconMinor: number;
  readonly percent: number;
  readonly reportedAt: Date;
}

// What a gate controller tells about its own equipment; each write stays inside the gate's lot.
export interface EquipmentReports {
  recordHeartbeat(gate: ReportingGate, at: Date): Promise<void>;
  // False when the lot has no beacon with this minor: nothing is written.
  recordBeaconBattery(report: BeaconBatteryReport): Promise<boolean>;
}
