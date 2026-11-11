// A walk Palier has not accepted yet: detectedAt is when the device saw it (ms), aisleMinor the aisle seen at that moment.
export interface QueuedWalk {
  readonly sessionId: string;
  readonly detectedAt: number;
  readonly aisleMinor: number | null;
}

export interface OfflineWalkStore {
  load(): Promise<readonly QueuedWalk[]>;
  save(walks: readonly QueuedWalk[]): Promise<void>;
}
