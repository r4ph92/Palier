import { ConnectivityMonitor } from './ConnectivityMonitor';
import type { PositioningListener, PositioningModule } from './PositioningModule';

export class PositioningCore {
  private readonly module: PositioningModule;
  private readonly subscribers = new Set<PositioningListener>();
  private readonly flushRequests = new Set<() => void>();
  readonly connectivity = new ConnectivityMonitor();
  private readonly fanOut: PositioningListener = {
    onAisleChanged: (minor, ts) => this.notify((subscriber) => subscriber.onAisleChanged(minor, ts)),
    onLotExit: (ts) => this.notify((subscriber) => subscriber.onLotExit(ts)),
    onParkedDetected: (confidence, ts) => this.notify((subscriber) => subscriber.onParkedDetected(confidence, ts)),
    onQueueFlushed: (count) => this.notify((subscriber) => subscriber.onQueueFlushed(count)),
  };

  constructor(module: PositioningModule) {
    this.module = module;
    module.setListener(this.fanOut);
  }

  startMonitoring(uuid: string, major: number): void {
    this.module.startMonitoring(uuid, major);
  }

  stopMonitoring(): void {
    this.module.stopMonitoring();
  }

  keepAlive(until: number): void {
    this.module.keepAlive(until);
  }

  // The bridge contract has no stop command: a keep-alive until an instant already reached ends it (docs/pont-natif.md).
  stopKeepAliveAt(instant: number): void {
    this.module.keepAlive(instant);
  }

  flushOfflineQueue(): void {
    this.module.flushOfflineQueue();
    for (const request of this.flushRequests) {
      request();
    }
  }

  // Runs when flushOfflineQueue() is sent: the app's queue of walks waiting for the network sends them then.
  onFlushRequested(request: () => void): () => void {
    this.flushRequests.add(request);
    return () => {
      this.flushRequests.delete(request);
    };
  }

  subscribe(listener: PositioningListener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  // The module calls back from native code: one failing subscriber must not starve the others nor escape.
  private notify(deliver: (subscriber: PositioningListener) => void): void {
    for (const subscriber of this.subscribers) {
      try {
        deliver(subscriber);
      } catch (error) {
        console.error('Positioning subscriber failed', error);
      }
    }
  }
}
