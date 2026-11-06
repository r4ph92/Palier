import type { CurrentParkingSession } from '@palier/shared-types';
import type { RefObject } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';
import { aisleWithMinor } from './aisleWithMinor';
import type { PositioningCore } from './PositioningCore';
import type { ParkedConfidence, PositioningListener } from './PositioningModule';

export interface LatestSession {
  readonly session: CurrentParkingSession | null;
  readonly refresh: () => void;
}

export interface WalkAwayContext {
  readonly sessionId: string;
  readonly positioning: PositioningCore;
  readonly client: ParkingSessionClient;
  readonly latest: RefObject<LatestSession>;
}

// aisleCode is followed here, not read from a render, so an aisle seen just before the walk always counts.
interface WalkAwayProgress {
  aisleCode: string | null;
  isSending: boolean;
  isReported: boolean;
  isActive: boolean;
}

interface Walk {
  readonly confidence: ParkedConfidence;
  readonly ts: number;
}

export interface WalkAwayWatch {
  readonly listener: PositioningListener;
  stop(): void;
}

// One watch per session: once Palier accepted its walk, the session never sends another.
export function watchWalkAway(context: WalkAwayContext): WalkAwayWatch {
  const progress: WalkAwayProgress = { aisleCode: null, isSending: false, isReported: false, isActive: true };
  const listener: PositioningListener = {
    onAisleChanged: (minor) => followAisle(context, progress, minor),
    onParkedDetected: (confidence, ts) => void reportWalk(context, progress, { confidence, ts }),
    onLotExit: () => undefined,
    onQueueFlushed: () => undefined,
  };
  return { listener, stop: () => (progress.isActive = false) };
}

// Like useCurrentAisle, a minor that matches no aisle keeps the last aisle seen.
function followAisle(context: WalkAwayContext, progress: WalkAwayProgress, minor: number): void {
  const aisles = context.latest.current.session?.levelPlan?.aisles ?? [];
  progress.aisleCode = aisleWithMinor(aisles, minor)?.code ?? progress.aisleCode;
}

// A refused or lost signal changes nothing: the offline queue (#26) will send it again.
async function reportWalk(context: WalkAwayContext, progress: WalkAwayProgress, walk: Walk): Promise<void> {
  if (!isPresumableWalk(context, progress, walk)) {
    return;
  }
  progress.isSending = true;
  try {
    await context.client.reportParked(context.sessionId, walk.ts);
    progress.isReported = true;
    settleAccepted(context, progress, walk);
  } catch (error) {
    reportUnexpectedFailure(error);
  } finally {
    progress.isSending = false;
  }
}

// Q36: any walk in the assigned aisle, or before any aisle was seen, presumes the spot; another aisle is left to #21.
function isPresumableWalk(context: WalkAwayContext, progress: WalkAwayProgress, walk: Walk): boolean {
  const session = context.latest.current.session;
  if (session?.sessionId !== context.sessionId || session.state === 'PARKED_PRESUMED') {
    return false;
  }
  if (walk.confidence === 'low' || progress.isSending || progress.isReported) {
    return false;
  }
  return progress.aisleCode === null || progress.aisleCode === session.spot.aisleCode;
}

// The contract has no stop command: a keep-alive until the walking instant ends it (docs/pont-natif.md).
function settleAccepted(context: WalkAwayContext, progress: WalkAwayProgress, walk: Walk): void {
  if (!progress.isActive) {
    return;
  }
  context.positioning.keepAlive(walk.ts);
  context.latest.current.refresh();
}

const EXPECTED_FAILURES = [PalierRejectedError, PalierUnreachableError, PalierUnauthorizedError, PalierConsentRequiredError];

// A refused token or a missing notice already moved the app off the tabs through the requester.
function reportUnexpectedFailure(error: unknown): void {
  if (EXPECTED_FAILURES.some((failure) => error instanceof failure)) {
    return;
  }
  console.error('Reporting the walk away from the car failed', error);
}
