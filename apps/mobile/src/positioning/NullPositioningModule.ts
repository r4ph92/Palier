import type { PositioningModule } from './PositioningModule';

export class NullPositioningModule implements PositioningModule {
  startMonitoring(): void {}
  stopMonitoring(): void {}
  keepAlive(): void {}
  flushOfflineQueue(): void {}
  setListener(): void {}
}
