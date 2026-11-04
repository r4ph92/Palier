import type { PositioningListener, PositioningModule } from './PositioningModule';

export class PositioningCore {
  private readonly module: PositioningModule;
  private readonly subscribers = new Set<PositioningListener>();
  private readonly fanOut: PositioningListener = {
    onAisleChanged: (minor, ts) => this.subscribers.forEach((subscriber) => subscriber.onAisleChanged(minor, ts)),
    onLotExit: (ts) => this.subscribers.forEach((subscriber) => subscriber.onLotExit(ts)),
    onParkedDetected: (confidence, ts) => this.subscribers.forEach((subscriber) => subscriber.onParkedDetected(confidence, ts)),
    onQueueFlushed: (count) => this.subscribers.forEach((subscriber) => subscriber.onQueueFlushed(count)),
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

  flushOfflineQueue(): void {
    this.module.flushOfflineQueue();
  }

  subscribe(listener: PositioningListener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }
}
