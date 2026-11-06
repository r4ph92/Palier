import type { CurrentParkingSession } from '@palier/shared-types';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import type { DetectedWalk, ParkingSessionClient } from '../api/ParkingSessionClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';
import { isWalkedAwayState } from '@palier/shared-types/entries';
import type { ConnectivityMonitor } from '../positioning/ConnectivityMonitor';
import type { AisleFollower } from '../positioning/AisleFollower';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { ParkedConfidence, PositioningListener } from '../positioning/PositioningModule';
import type { ParkedSignalQueue, PendingWalk } from './ParkedSignalQueue';

export interface LatestSession {
  readonly session: CurrentParkingSession | null;
  readonly refresh: () => void;
}

export interface WalkAwayContext {
  readonly sessionId: string;
  readonly positioning: PositioningCore;
  readonly client: ParkingSessionClient;
  readonly latest: () => LatestSession;
  readonly aisles: AisleFollower;
  readonly queue: ParkedSignalQueue;
  readonly connectivity: ConnectivityMonitor;
}

interface Walk {
  readonly confidence: ParkedConfidence;
  readonly detectedAt: number;
}

const EXPECTED_FAILURES = [PalierRejectedError, PalierUnreachableError, PalierUnauthorizedError, PalierConsentRequiredError];

// One watch per session: once Palier accepted its walk, the session never sends another.
export class WalkAwayWatch {
  readonly listener: PositioningListener;
  readonly #context: WalkAwayContext;
  #isSending = false;
  #isReported = false;
  #isActive = true;
  readonly #stopListening: readonly (() => void)[];

  constructor(context: WalkAwayContext) {
    this.#context = context;
    this.#stopListening = [
      context.connectivity.subscribe((connectivity) => connectivity === 'online' && void this.flush()),
      context.positioning.onFlushRequested(() => void this.flush()),
    ];
    void context.queue.ready().then(() => this.flush());
    this.listener = {
      onAisleChanged: () => undefined,
      onParkedDetected: (confidence, detectedAt) => void this.#onWalk({ confidence, detectedAt }),
      onLotExit: () => undefined,
      onQueueFlushed: () => undefined,
    };
  }

  stop(): void {
    this.#isActive = false;
    this.#stopListening.forEach((stopListening) => stopListening());
  }

  // Sends the walk kept while the network was down, with the instant the driver walked away, not the instant of the send.
  async flush(): Promise<void> {
    const { queue, connectivity, sessionId } = this.#context;
    const walk = queue.walkFor(sessionId);
    if (walk === undefined || connectivity.current === 'offline' || this.#isSending || this.#isReported || !this.#isActive) {
      return;
    }
    const outcome = await this.#report(walk);
    if (outcome === 'unreachable') {
      return;
    }
    await queue.remove(sessionId);
    if (outcome === 'accepted') {
      queue.announceSent(1);
      this.#settle(walk);
    }
  }

  async #onWalk(walk: Walk): Promise<void> {
    if (!this.#isReportable(walk)) {
      return;
    }
    const { queue, connectivity, sessionId } = this.#context;
    if (queue.walkFor(sessionId) !== undefined) {
      // The first walk is already kept and says better when the driver left: send that one once the network allows it.
      return this.flush();
    }
    const pending = this.#pendingWalk(walk);
    if (connectivity.current === 'offline') {
      await queue.add(pending);
      return;
    }
    const outcome = await this.#report(pending);
    if (outcome === 'unreachable') {
      await queue.add(pending);
    } else if (outcome === 'accepted') {
      this.#settle(walk);
    }
  }

  #pendingWalk({ detectedAt }: Walk): PendingWalk {
    const { sessionId, aisles } = this.#context;
    return { sessionId, detectedAt, aisleMinor: aisles.currentFor(sessionId)?.beaconMinor ?? null };
  }

  #settle(walk: Pick<Walk, 'detectedAt'>): void {
    try {
      this.#settleAccepted(walk);
    } catch (error) {
      console.error('Settling the accepted walk failed', error);
    }
  }

  #isReportable(walk: Walk): boolean {
    const session = this.#context.latest().session;
    if (session?.sessionId !== this.#context.sessionId || isWalkedAwayState(session.state)) {
      return false;
    }
    return walk.confidence !== 'low' && !this.#isSending && !this.#isReported;
  }

  // Q36: Palier presumes the assigned spot for a walk in its aisle or before any aisle was seen, and asks where
  // the car is for a walk in another aisle. A lost signal is kept by the queue and sent again when the network is back;
  // a refusal changes nothing and the walk is dropped, since sending it again would be refused the same way.
  async #report({ detectedAt, aisleMinor }: DetectedWalk): Promise<'accepted' | 'unreachable' | 'refused'> {
    this.#isSending = true;
    try {
      await this.#context.client.reportParked(this.#context.sessionId, {
        detectedAt,
        aisleMinor,
      });
      this.#isReported = true;
      return 'accepted';
    } catch (error) {
      logUnexpectedFailure(error);
      return error instanceof PalierRejectedError ? 'refused' : 'unreachable';
    } finally {
      this.#isSending = false;
    }
  }

  #settleAccepted(walk: Pick<Walk, 'detectedAt'>): void {
    if (!this.#isActive) {
      return;
    }
    this.#context.positioning.stopKeepAliveAt(walk.detectedAt);
    this.#context.latest().refresh();
  }
}

// A refused token or a missing notice already moved the app off the tabs through the requester.
function logUnexpectedFailure(error: unknown): void {
  if (EXPECTED_FAILURES.some((failure) => error instanceof failure)) {
    return;
  }
  console.error('Reporting the walk away from the car failed', error);
}
