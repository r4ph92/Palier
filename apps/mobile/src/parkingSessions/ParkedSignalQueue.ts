import * as SecureStore from 'expo-secure-store';
import type { DetectedWalk } from '../api/ParkingSessionClient';

export interface PendingWalk extends DetectedWalk {
  readonly sessionId: string;
}

export interface QueueStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

const STORAGE_KEY = 'palier.pendingWalks';

// The keychain keeps the walks across a kill and a relaunch of the app.
export const secureQueueStorage: QueueStorage = {
  read: () => SecureStore.getItemAsync(STORAGE_KEY),
  write: (value) => SecureStore.setItemAsync(STORAGE_KEY, value),
};

export function memoryQueueStorage(): QueueStorage {
  let value: string | null = null;
  return {
    read: () => Promise.resolve(value),
    write: (next) => {
      value = next;
      return Promise.resolve();
    },
  };
}

type QueueListener = () => void;
type SentListener = (count: number) => void;

// Walks the app could not send, kept with the instant the driver walked away. One per session: the first one wins.
export class ParkedSignalQueue {
  readonly #storage: QueueStorage;
  readonly #listeners = new Set<QueueListener>();
  readonly #sentListeners = new Set<SentListener>();
  #walks: readonly PendingWalk[] = [];
  readonly #loaded: Promise<void>;
  #writes: Promise<void> = Promise.resolve();

  constructor(storage: QueueStorage) {
    this.#storage = storage;
    this.#loaded = this.#load();
  }

  get count(): number {
    return this.#walks.length;
  }

  ready(): Promise<void> {
    return this.#loaded;
  }

  walkFor(sessionId: string): PendingWalk | undefined {
    return this.#walks.find((walk) => walk.sessionId === sessionId);
  }

  async add(walk: PendingWalk): Promise<void> {
    await this.#loaded;
    if (this.walkFor(walk.sessionId) !== undefined) {
      return;
    }
    await this.#replace([...this.#walks, walk]);
  }

  async remove(sessionId: string): Promise<void> {
    await this.#loaded;
    if (this.walkFor(sessionId) === undefined) {
      return;
    }
    await this.#replace(this.#walks.filter((walk) => walk.sessionId !== sessionId));
  }

  // Signing out forgets the walks of the driver who leaves.
  async clear(): Promise<void> {
    await this.#loaded;
    await this.#replace([]);
  }

  subscribe(listener: QueueListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  // Says that walks left the queue because Palier took them, so the screen can tell the driver.
  announceSent(count: number): void {
    for (const listener of this.#sentListeners) {
      listener(count);
    }
  }

  onSent(listener: SentListener): () => void {
    this.#sentListeners.add(listener);
    return () => {
      this.#sentListeners.delete(listener);
    };
  }

  async #replace(walks: readonly PendingWalk[]): Promise<void> {
    this.#walks = walks;
    for (const listener of this.#listeners) {
      listener();
    }
    const saved = JSON.stringify(walks);
    // One write at a time, oldest first, so a slow older snapshot never lands after a newer one.
    this.#writes = this.#writes.then(() => this.#storage.write(saved)).catch((error: unknown) => console.error('Saving the waiting walks failed', error));
    await this.#writes;
  }

  async #load(): Promise<void> {
    try {
      const saved = await this.#storage.read();
      this.#walks = saved === null ? [] : parseWalks(saved);
    } catch (error) {
      console.error('Reading the waiting walks failed', error);
      this.#walks = [];
    }
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

function parseWalks(saved: string): readonly PendingWalk[] {
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed.filter(isPendingWalk) : [];
}

function isPendingWalk(value: unknown): value is PendingWalk {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { sessionId, detectedAt, aisleMinor } = value as Record<string, unknown>;
  return typeof sessionId === 'string' && typeof detectedAt === 'number' && (aisleMinor === null || typeof aisleMinor === 'number');
}
