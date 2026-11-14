// A reading as a technician or a controller gives it, stamped by the server's clock when it is recorded.
export interface RecordedBatteryReading {
  readonly percent: number;
  readonly reportedAt: Date;
}

// What a beacon holds from its last reading: both fields are null when it never had one.
export interface LastBatteryReading {
  readonly percent: number | null;
  readonly reportedAt: Date | null;
}
