import type { ParkedConfidence, PositioningListener, PositioningModule } from '../positioning/PositioningModule';
import type { Connectivity } from '../api/ConnectivitySource';
import { describeCommand, describeConnectivity } from './describeSignal';
import { SimulatedConnectivity } from './SimulatedConnectivity';
import type { SignalJournal } from './SignalJournal';

export class SimulatedPositioningModule implements PositioningModule {
  private readonly journal: SignalJournal;
  private readonly now: () => number;
  private readonly connectivity: SimulatedConnectivity;
  private listener: PositioningListener | null = null;

  // A module built without a connectivity keeps its network to itself: the app it feeds stays online.
  constructor(journal: SignalJournal, now: () => number, connectivity = new SimulatedConnectivity()) {
    this.journal = journal;
    this.now = now;
    this.connectivity = connectivity;
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
    this.connectivity.set(connectivity);
  }
}
