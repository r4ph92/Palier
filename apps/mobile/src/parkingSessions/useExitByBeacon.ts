import type { CurrentParkingSession, ExitReceipt } from '@palier/shared-types';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import type { ReceiptClient } from '../api/ReceiptClient';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { PositioningListener } from '../positioning/PositioningModule';
import type { CurrentParkingSessionController } from './useCurrentParkingSession';

// The exit lane's beacon is minor 0 (docs/pont-natif.md).
export const EXIT_LANE_MINOR = 0;
// Palier opens only for a report and a vehicle that are less than this far apart, so the app stops looking after it.
export const BEACON_WATCH_MILLISECONDS = 60_000;
export const BEACON_POLL_MILLISECONDS = 4_000;
// The module may call back at every ranging: one report a few seconds apart says it all.
export const BEACON_REPORT_AGAIN_MILLISECONDS = 15_000;

export interface LeftByBeacon {
  readonly sessionId: string;
  // Null when the receipt could not be read yet: the pending screen asks again.
  readonly receipt: ExitReceipt | null;
}

export interface ExitByBeacon {
  // Set once Palier closed the session after this app reported the beacon: the receipt shows without a tap.
  readonly left: LeftByBeacon | null;
  clear(): void;
}

interface ExitByBeaconTools {
  readonly positioning: PositioningCore;
  readonly sessions: ParkingSessionClient;
  readonly receipts: ReceiptClient;
}

// Reports the exit beacon when the device sees it, then reads the session until Palier has opened the barrier or the minute is over (decision 029).
// A report that fails changes nothing for the driver, who still has the « Ouvrir » tap.
export function useExitByBeacon({ positioning, sessions, receipts }: ExitByBeaconTools, currentSession: CurrentParkingSessionController): ExitByBeacon {
  const { state, poll } = currentSession;
  const [watchedSessionId, setWatchedSessionId] = useState<string | null>(null);
  const [left, setLeft] = useState<LeftByBeacon | null>(null);
  useReportOnExitLane({ positioning, sessions, onReported: setWatchedSessionId }, state.status === 'current' ? state.session : null);
  useWatch(watchedSessionId, poll, () => setWatchedSessionId(null));
  const closedSessionId = watchedSessionId !== null && state.status === 'none' ? watchedSessionId : null;
  useEffect(() => {
    if (closedSessionId !== null) {
      const finish = (receipt: ExitReceipt | null) => {
        setWatchedSessionId(null);
        setLeft({ sessionId: closedSessionId, receipt });
      };
      receipts.findReceipt(closedSessionId).then(({ receipt }) => finish(receipt), () => finish(null));
    }
  }, [closedSessionId, receipts]);
  const clear = useCallback(() => setLeft(null), []);
  return { left, clear };
}

interface ReportTools {
  readonly positioning: PositioningCore;
  readonly sessions: ParkingSessionClient;
  readonly onReported: (sessionId: string) => void;
}

interface Reporter extends Pick<ReportTools, 'sessions' | 'onReported'> {
  readonly latest: RefObject<CurrentParkingSession | null>;
  readonly lastReport: RefObject<{ readonly sessionId: string; readonly at: number }>;
}

function useReportOnExitLane({ positioning, sessions, onReported }: ReportTools, session: CurrentParkingSession | null): void {
  const latest = useRef(session);
  const lastReport = useRef({ sessionId: '', at: 0 });
  useEffect(() => {
    latest.current = session;
  });
  useEffect(() => positioning.subscribe(exitLaneListener({ latest, lastReport, sessions, onReported })), [positioning, sessions, onReported]);
}

function exitLaneListener({ latest, lastReport, sessions, onReported }: Reporter): PositioningListener {
  return {
    onAisleChanged: (minor) => {
      const session = latest.current;
      const now = Date.now();
      const isRepeat = session !== null && lastReport.current.sessionId === session.sessionId && now - lastReport.current.at < BEACON_REPORT_AGAIN_MILLISECONDS;
      if (minor !== EXIT_LANE_MINOR || session === null || session.beaconMajor === null || session.state === 'CREATED' || isRepeat) {
        return;
      }
      lastReport.current = { sessionId: session.sessionId, at: now };
      sessions.reportExitBeacon(session.sessionId, session.beaconMajor).catch(() => undefined);
      onReported(session.sessionId);
    },
    onLotExit: () => undefined,
    onParkedDetected: () => undefined,
    onQueueFlushed: () => undefined,
  };
}

// Reads the session every few seconds while a report is fresh, so the barrier's opening shows without waiting for the minute poll.
function useWatch(watchedSessionId: string | null, poll: () => void, onOver: () => void): void {
  useEffect(() => {
    if (watchedSessionId === null) {
      return;
    }
    const timer = setInterval(poll, BEACON_POLL_MILLISECONDS);
    const end = setTimeout(onOver, BEACON_WATCH_MILLISECONDS);
    return () => {
      clearInterval(timer);
      clearTimeout(end);
    };
  }, [watchedSessionId, poll, onOver]);
}
