import type { CurrentParkingSession } from '@palier/shared-types';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';
import { isParked } from './isParked';
import type { AisleFollower } from '../positioning/AisleFollower';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { ParkedConfidence, PositioningListener } from '../positioning/PositioningModule';

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

  constructor(context: WalkAwayContext) {
    this.#context = context;
    this.listener = {
      onAisleChanged: () => undefined,
      onParkedDetected: (confidence, detectedAt) => void this.#onWalk({ confidence, detectedAt }),
      onLotExit: () => undefined,
      onQueueFlushed: () => undefined,
    };
  }

  stop(): void {
    this.#isActive = false;
  }

  async #onWalk(walk: Walk): Promise<void> {
    if (!this.#isPresumable(walk) || !(await this.#report(walk))) {
      return;
    }
    try {
      this.#settleAccepted(walk);
    } catch (error) {
      console.error('Settling the accepted walk failed', error);
    }
  }

  // Q36: any walk in the assigned aisle, or before any aisle was seen, presumes the spot; another aisle is left to #21.
  #isPresumable(walk: Walk): boolean {
    const session = this.#context.latest().session;
    if (session?.sessionId !== this.#context.sessionId || isParked(session.state)) {
      return false;
    }
    if (walk.confidence === 'low' || this.#isSending || this.#isReported) {
      return false;
    }
    const aisle = this.#context.aisles.current();
    return aisle === null || aisle.code === session.spot.aisleCode;
  }

  // A refused or lost signal changes nothing: the offline queue (#26) will send it again.
  async #report(walk: Walk): Promise<boolean> {
    this.#isSending = true;
    try {
      await this.#context.client.reportParked(this.#context.sessionId, walk.detectedAt);
      this.#isReported = true;
      return true;
    } catch (error) {
      logUnexpectedFailure(error);
      return false;
    } finally {
      this.#isSending = false;
    }
  }

  #settleAccepted(walk: Walk): void {
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
