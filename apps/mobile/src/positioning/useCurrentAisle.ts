import type { CurrentParkingSession, PlanAisle } from '@palier/shared-types';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PositioningCore } from './PositioningCore';
import type { PositioningListener } from './PositioningModule';

interface AisleSighting {
  readonly sessionId: string;
  readonly minor: number;
}

const IGNORED_SIGNALS: Omit<PositioningListener, 'onAisleChanged'> = {
  onLotExit: () => undefined,
  onParkedDetected: () => undefined,
  onQueueFlushed: () => undefined,
};

// The aisle the driver was last seen in during this session. A minor that matches no aisle of the plan
// (the exit lane, another lot's beacon) changes nothing, and a sighting never outlives its session.
export function useCurrentAisle(positioning: PositioningCore, session: CurrentParkingSession | null): PlanAisle | null {
  const aisles = session?.levelPlan?.aisles ?? [];
  const latestAisles = useRef(aisles);
  useEffect(() => {
    latestAisles.current = aisles;
  });
  const sessionId = session?.sessionId ?? null;
  const sighting = useAisleSighting(positioning, sessionId, latestAisles);
  return sighting === null || sighting.sessionId !== sessionId ? null : aisleWithMinor(aisles, sighting.minor);
}

// No session, no subscription: a signal received outside a session is dropped, never kept for the next one.
function useAisleSighting(positioning: PositioningCore, sessionId: string | null, aisles: RefObject<readonly PlanAisle[]>): AisleSighting | null {
  const [sighting, setSighting] = useState<AisleSighting | null>(null);
  useEffect(() => {
    if (sessionId === null) {
      return;
    }
    const onAisleChanged = (minor: number) => {
      if (aisleWithMinor(aisles.current, minor) !== null) {
        setSighting({ sessionId, minor });
      }
    };
    return positioning.subscribe({ ...IGNORED_SIGNALS, onAisleChanged });
  }, [positioning, sessionId, aisles]);
  return sighting;
}

function aisleWithMinor(aisles: readonly PlanAisle[], minor: number): PlanAisle | null {
  return aisles.find((aisle) => aisle.beaconMinor === minor) ?? null;
}
