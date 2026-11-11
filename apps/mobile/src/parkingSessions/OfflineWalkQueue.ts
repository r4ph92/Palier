import type { OfflineWalkStore, QueuedWalk } from './OfflineWalkStore';

// One walk per session, the earliest: Palier keeps the first instant it hears, so an earlier one is the one worth sending.
export function mergeWalk(walks: readonly QueuedWalk[], walk: QueuedWalk): readonly QueuedWalk[] {
  const kept = walks.find((queued) => queued.sessionId === walk.sessionId);
  if (kept !== undefined && kept.detectedAt <= walk.detectedAt) {
    return walks;
  }
  return [...walks.filter((queued) => queued.sessionId !== walk.sessionId), walk];
}

// The walks waiting for Palier, restored from the store on first use and saved after every change.
// A failed save keeps the walks in memory: they are still sent while the app runs.
export class OfflineWalkQueue {
  readonly #store: OfflineWalkStore;
  #walks: readonly QueuedWalk[] = [];
  #restoring: Promise<void> | null = null;
  #saving: Promise<void> = Promise.resolve();

  constructor(store: OfflineWalkStore) {
    this.#store = store;
  }

  async walks(): Promise<readonly QueuedWalk[]> {
    await this.#restored();
    return this.#walks;
  }

  // What is known now, without waiting for the store.
  countFor(sessionId: string): number {
    return this.#walks.filter((walk) => walk.sessionId === sessionId).length;
  }

  get size(): number {
    return this.#walks.length;
  }

  async holdsWalkFor(sessionId: string): Promise<boolean> {
    await this.#restored();
    return this.countFor(sessionId) > 0;
  }

  async add(walk: QueuedWalk): Promise<void> {
    await this.#change((walks) => mergeWalk(walks, walk));
  }

  // Only the walk that was sent leaves: an earlier one merged in meanwhile still waits. False when nothing left.
  async remove(sent: QueuedWalk): Promise<boolean> {
    const sizeBefore = (await this.walks()).length;
    await this.#change((walks) => walks.filter((walk) => walk.sessionId !== sent.sessionId || walk.detectedAt !== sent.detectedAt));
    return this.#walks.length < sizeBefore;
  }

  async clear(): Promise<void> {
    await this.#change(() => []);
  }

  async #change(next: (walks: readonly QueuedWalk[]) => readonly QueuedWalk[]): Promise<void> {
    await this.#restored();
    this.#walks = next(this.#walks);
    await this.#save(this.#walks);
  }

  #save(walks: readonly QueuedWalk[]): Promise<void> {
    this.#saving = this.#saving
      .then(() => this.#store.save(walks))
      .catch((error: unknown) => console.error('Saving the offline walks failed', error));
    return this.#saving;
  }

  #restored(): Promise<void> {
    this.#restoring ??= this.#store.load().then(
      (loaded) => {
        this.#walks = loaded.reduce(mergeWalk, this.#walks);
      },
      (error: unknown) => console.error('Reading the offline walks failed', error),
    );
    return this.#restoring;
  }
}
