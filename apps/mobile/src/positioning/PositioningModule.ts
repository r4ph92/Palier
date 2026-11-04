export type ParkedConfidence = 'low' | 'medium' | 'high';

export interface PositioningListener {
  onAisleChanged(minor: number, ts: number): void;
  onLotExit(ts: number): void;
  onParkedDetected(confidence: ParkedConfidence, ts: number): void;
  onQueueFlushed(count: number): void;
}

export interface PositioningModule {
  startMonitoring(uuid: string, major: number): void;
  stopMonitoring(): void;
  keepAlive(until: number): void;
  flushOfflineQueue(): void;
  setListener(listener: PositioningListener | null): void;
}
