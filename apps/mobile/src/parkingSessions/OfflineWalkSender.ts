import { AppState, type NativeEventSubscription } from 'react-native';
import type { ConnectivitySource } from '../api/ConnectivitySource';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { OfflineWalkQueue } from './OfflineWalkQueue';
import type { QueuedWalk } from './OfflineWalkStore';
import { RetryTimer } from './RetryTimer';
import { walkSendOutcome, type WalkSendOutcome } from './walkSendOutcome';

export const RETRY_MILLISECONDS = 10_000;

export interface OfflineWalkListener {
  // A queued walk Palier accepted, whether it recorded it now or already had the session parked.
  readonly onReplayed?: (walk: QueuedWalk) => void;
  readonly onChange?: () => void;
}

export type SubmitResult = 'sent' | 'queued' | 'dropped';

export interface OfflineWalkSenderTools {
  readonly client: ParkingSessionClient;
  readonly queue: OfflineWalkQueue;
  readonly connectivity: ConnectivitySource;
  readonly positioning: PositioningCore;
}

// Sends a walk at once when it can, keeps it when Palier cannot be reached, and sends the kept walks again
// when the network comes back, when the app returns to the front, and every 10 s while any waits (decision 024).
export class OfflineWalkSender {
  readonly #tools: OfflineWalkSenderTools;
  readonly #listeners = new Set<OfflineWalkListener>();
  readonly #retry = new RetryTimer(() => void this.flush(), RETRY_MILLISECONDS);
  #flight: Promise<void> | null = null;
  #stops: (() => void)[] = [];

  constructor(tools: OfflineWalkSenderTools) {
    this.#tools = tools;
  }

  start(): () => void {
    const unsubscribe = this.#tools.connectivity.subscribe((connectivity) => this.#reconnectIf(connectivity === 'online'));
    const appState: NativeEventSubscription = AppState.addEventListener('change', (state) => this.#reconnectIf(state === 'active'));
    this.#stops = [unsubscribe, () => appState.remove()];
    return () => this.dispose();
  }

  dispose(): void {
    this.#stops.forEach((stop) => stop());
    this.#retry.stop();
  }

  pendingFor(sessionId: string): number {
    return this.#tools.queue.countFor(sessionId);
  }

  subscribe(listener: OfflineWalkListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  // A session that already has a walk waiting merges the new one into it: it is never sent on its own.
  async submit(walk: QueuedWalk): Promise<SubmitResult> {
    if (this.#isOffline() || (await this.#tools.queue.holdsWalkFor(walk.sessionId))) {
      await this.#keep(walk);
      void this.flush();
      return 'queued';
    }
    return this.#sendLive(walk);
  }

  // One flush at a time: a second call while one runs waits for it instead of sending the same walks twice.
  flush(): Promise<void> {
    this.#flight ??= this.#replayAll().finally(() => {
      this.#flight = null;
    });
    return this.#flight;
  }

  async clear(): Promise<void> {
    await this.#tools.queue.clear();
    this.#changed();
  }

  async #sendLive(walk: QueuedWalk): Promise<SubmitResult> {
    try {
      await this.#send(walk);
      return 'sent';
    } catch (error) {
      if (this.#outcomeOf(error) !== 'keep') {
        return 'dropped';
      }
      await this.#keep(walk);
      return 'queued';
    }
  }

  // The walks of every session are sent, not only the one on screen: Palier decides, and refuses another driver's.
  async #replayAll(): Promise<void> {
    if (this.#isOffline()) {
      return;
    }
    for (const walk of await this.#tools.queue.walks()) {
      if (!(await this.#replay(walk))) {
        return;
      }
    }
  }

  // False when Palier could not be reached: the walks after this one wait for the next try.
  async #replay(walk: QueuedWalk): Promise<boolean> {
    try {
      await this.#send(walk);
      if (await this.#forget(walk)) {
        this.#notify((listener) => listener.onReplayed?.(walk));
      }
      return true;
    } catch (error) {
      if (this.#outcomeOf(error) === 'keep') {
        return false;
      }
      await this.#forget(walk);
      return true;
    }
  }

  async #send({ sessionId, detectedAt, aisleMinor }: QueuedWalk): Promise<void> {
    await this.#tools.client.reportParked(sessionId, { detectedAt, aisleMinor });
  }

  #outcomeOf(error: unknown): WalkSendOutcome {
    const outcome = walkSendOutcome(error);
    if (outcome === 'unexpected') {
      console.error('Reporting the walk away from the car failed', error);
    }
    return outcome;
  }

  async #keep(walk: QueuedWalk): Promise<void> {
    await this.#tools.queue.add(walk);
    this.#changed();
  }

  // An earlier walk merged in while this one was on its way stays, and is the one counted once sent.
  async #forget(walk: QueuedWalk): Promise<boolean> {
    const isForgotten = await this.#tools.queue.remove(walk);
    this.#changed();
    return isForgotten;
  }

  // The native module's own buffer first: it hands back its walks with their first instant, merged into the queue.
  #reconnectIf(isBack: boolean): void {
    if (!isBack) {
      return;
    }
    this.#tools.positioning.flushOfflineQueue();
    void this.flush();
  }

  #isOffline(): boolean {
    return this.#tools.connectivity.current() === 'offline';
  }

  #changed(): void {
    this.#retry.runWhile(this.#tools.queue.size > 0);
    this.#notify((listener) => listener.onChange?.());
  }

  #notify(deliver: (listener: OfflineWalkListener) => void): void {
    this.#listeners.forEach(deliver);
  }
}
