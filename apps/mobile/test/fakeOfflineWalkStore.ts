import type { OfflineWalkStore, QueuedWalk } from '../src/parkingSessions/OfflineWalkStore';

// Shared by two renders of the app, it stands for the file that outlives a killed app.
export class MemoryOfflineWalkStore implements OfflineWalkStore {
  walks: readonly QueuedWalk[];
  saveFailure: Error | null = null;
  loads = 0;

  constructor(walks: readonly QueuedWalk[] = []) {
    this.walks = walks;
  }

  load(): Promise<readonly QueuedWalk[]> {
    this.loads += 1;
    return Promise.resolve(this.walks);
  }

  save(walks: readonly QueuedWalk[]): Promise<void> {
    if (this.saveFailure !== null) {
      return Promise.reject(this.saveFailure);
    }
    this.walks = walks;
    return Promise.resolve();
  }
}
