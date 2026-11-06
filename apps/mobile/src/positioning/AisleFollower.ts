import type { PlanAisle } from '@palier/shared-types';
import type { PositioningListener } from './PositioningModule';

export interface FollowedSession {
  readonly sessionId: string;
  readonly aisles: readonly PlanAisle[];
}

// The aisle the driver was last seen in during the current session, read synchronously by the walk-away watch and as state by the screen.
// A minor that matches no aisle of the plan (the exit lane, another lot's beacon) changes nothing, and a sighting never outlives its session.
export class AisleFollower {
  readonly listener: PositioningListener = {
    onAisleChanged: (minor) => this.#see(minor),
    onLotExit: () => undefined,
    onParkedDetected: () => undefined,
    onQueueFlushed: () => undefined,
  };
  readonly #onChange = new Set<() => void>();
  #session: FollowedSession | null = null;
  #sightedMinor: number | null = null;

  follow(session: FollowedSession | null): void {
    if (session?.sessionId !== this.#session?.sessionId) {
      this.#sightedMinor = null;
    }
    this.#session = session;
    this.#notify();
  }

  // A render can come before follow() is told of a new session: it then reads nothing, never the last session's aisle.
  currentFor(sessionId: string | null): PlanAisle | null {
    if (this.#session === null || this.#session.sessionId !== sessionId || this.#sightedMinor === null) {
      return null;
    }
    return aisleWithMinor(this.#session.aisles, this.#sightedMinor);
  }

  readonly subscribe = (onChange: () => void): (() => void) => {
    this.#onChange.add(onChange);
    return () => {
      this.#onChange.delete(onChange);
    };
  };

  #see(minor: number): void {
    if (this.#session === null || aisleWithMinor(this.#session.aisles, minor) === null) {
      return;
    }
    this.#sightedMinor = minor;
    this.#notify();
  }

  #notify(): void {
    this.#onChange.forEach((onChange) => onChange());
  }
}

function aisleWithMinor(aisles: readonly PlanAisle[], minor: number): PlanAisle | null {
  return aisles.find((aisle) => aisle.beaconMinor === minor) ?? null;
}
