import type { CurrentParkingSession } from '@palier/shared-types';
import { isWalkedAwayState } from '@palier/shared-types/entries';
import type { AisleFollower } from '../positioning/AisleFollower';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { ParkedConfidence, PositioningListener } from '../positioning/PositioningModule';
import type { OfflineWalkListener, OfflineWalkSender, SubmitResult } from './OfflineWalkSender';
import type { QueuedWalk } from './OfflineWalkStore';

export interface LatestSession {
  readonly session: CurrentParkingSession | null;
  readonly refresh: () => void;
}

export interface WalkAwayContext {
  readonly sessionId: string;
  readonly positioning: PositioningCore;
  readonly sender: OfflineWalkSender;
  readonly latest: () => LatestSession;
  readonly aisles: AisleFollower;
}

interface Walk {
  readonly confidence: ParkedConfidence;
  readonly detectedAt: number;
}

// One watch per session: once Palier accepted its walk, sent now or kept and sent later, the session never sends another.
export class WalkAwayWatch {
  readonly listener: PositioningListener;
  readonly replays: OfflineWalkListener;
  readonly #context: WalkAwayContext;
  #isSending = false;
  #isReported = false;
  #isActive = true;

  constructor(context: WalkAwayContext) {
    this.#context = context;
    this.listener = {
      onAisleChanged: () => undefined,
      onParkedDetected: (confidence, detectedAt) => void this.#onWalk({ confidence, detectedAt }),
      onLotExit: () => undefined,
      onQueueFlushed: () => undefined,
    };
    this.replays = { onReplayed: (walk) => this.#onReplayed(walk) };
  }

  stop(): void {
    this.#isActive = false;
  }

  async #onWalk(walk: Walk): Promise<void> {
    if (!this.#isReportable(walk)) {
      return;
    }
    const queued = this.#queuedWalk(walk);
    if ((await this.#submit(queued)) === 'sent') {
      this.#isReported = true;
      this.#settleAccepted(queued.detectedAt);
    }
  }

  #onReplayed(walk: QueuedWalk): void {
    if (walk.sessionId !== this.#context.sessionId) {
      return;
    }
    this.#isReported = true;
    this.#settleAccepted(walk.detectedAt);
  }

  #isReportable(walk: Walk): boolean {
    const session = this.#context.latest().session;
    if (session?.sessionId !== this.#context.sessionId || isWalkedAwayState(session.state)) {
      return false;
    }
    return walk.confidence !== 'low' && !this.#isSending && !this.#isReported;
  }

  // Q36: Palier presumes the assigned spot for a walk in its aisle or before any aisle was seen, and asks where
  // the car is for a walk in another aisle. The aisle is the one seen at the walk, even when it is sent later.
  #queuedWalk({ detectedAt }: Walk): QueuedWalk {
    const aisle = this.#context.aisles.currentFor(this.#context.sessionId);
    return { sessionId: this.#context.sessionId, detectedAt, aisleMinor: aisle?.beaconMinor ?? null };
  }

  async #submit(walk: QueuedWalk): Promise<SubmitResult> {
    this.#isSending = true;
    try {
      return await this.#context.sender.submit(walk);
    } finally {
      this.#isSending = false;
    }
  }

  #settleAccepted(detectedAt: number): void {
    if (!this.#isActive) {
      return;
    }
    try {
      this.#context.positioning.stopKeepAliveAt(detectedAt);
      this.#context.latest().refresh();
    } catch (error) {
      console.error('Settling the accepted walk failed', error);
    }
  }
}
