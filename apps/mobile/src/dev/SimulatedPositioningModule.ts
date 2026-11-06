import type { ParkedConfidence, PositioningListener, PositioningModule } from '../positioning/PositioningModule';
import { describeCommand, describeConnectivity } from './describeSignal';
import type { Connectivity } from '../positioning/Connectivity';
import type { SignalJournal } from './SignalJournal';

export class SimulatedPositioningModule implements PositioningModule {
  private readonly journal: SignalJournal;
  private readonly now: () => number;
  private listener: PositioningListener | null = null;

  constructor(journal: SignalJournal, now: () => number) {
    this.journal = journal;
    this.now = now;
  }

  startMonitoring(uuid: string, major: number): void {
    this.journal.append(describeCommand.startMonitoring(uuid, major));
  }

  stopMonitoring(): void {
    this.journal.append(describeCommand.stopMonitoring());
  }

  keepAlive(until: number): void {
    this.journal.append(until <= this.now() ? describeCommand.keepAliveStop(until) : describeCommand.keepAlive(until));
  }

  flushOfflineQueue(): void {
    this.journal.append(describeCommand.flushOfflineQueue());
    this.listener?.onQueueFlushed(0);
  }

  setListener(listener: PositioningListener | null): void {
    this.listener = listener;
  }

  enterAisle(minor: number): void {
    this.listener?.onAisleChanged(minor, this.now());
  }

  exitLot(): void {
    this.listener?.onLotExit(this.now());
  }

  detectParked(confidence: ParkedConfidence): void {
    this.listener?.onParkedDetected(confidence, this.now());
  }

  setConnectivity(connectivity: Connectivity): void {
    this.journal.append(describeConnectivity(connectivity));
  }
}
