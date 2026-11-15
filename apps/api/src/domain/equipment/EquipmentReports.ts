import type { RecordedBatteryReading } from './batteryReadings.ts';

export interface ReportingGate {
  readonly id: string;
  readonly lotId: string;
}

export interface BeaconBatteryReport extends RecordedBatteryReading {
  readonly lotId: string;
  readonly beaconMinor: number;
}

// heardSince: the oldest heartbeat that still counts the gate as heard at the moment of the test.
export interface TestPassage {
  readonly at: Date;
  readonly heardSince: Date;
}

// What a gate controller tells about its own equipment; each write stays inside the gate's lot.
export interface EquipmentReports {
  recordHeartbeat(gate: ReportingGate, at: Date): Promise<void>;
  // False when the lot has no beacon with this minor: nothing is written.
  recordBeaconBattery(report: BeaconBatteryReport): Promise<boolean>;
  // False when the gate was not heard since passage.heardSince: nothing is written.
  recordTestPassage(gate: ReportingGate, passage: TestPassage): Promise<boolean>;
}
