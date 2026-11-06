import type { SpotTakenResponse } from '@palier/shared-types';
import { useCallback, useState } from 'react';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { useSingleFlight } from '../useSingleFlight';
import { spotTakenFailureOf } from './spotTakenOutcome';

export interface SpotTakenReportController {
  readonly isSending: boolean;
  readonly isUnreachable: boolean;
  // Grows with every report Palier did not get, so the same message twice is announced twice.
  readonly attempts: number;
  report(): void;
  // The message was about the report given up; reopening the question starts clean.
  clearProblem(): void;
}

export interface SpotTakenReportTarget {
  readonly sessionId: string;
  // The spot as the app shows it: Palier refuses a report naming a spot the session no longer has.
  readonly spotNumber: string;
}

interface ReportHandlers {
  readonly onReported: (response: SpotTakenResponse | null) => void;
  readonly onUnreachable: () => void;
}

// One report at a time; any answer that settles it reads the session again (the new spot, or the question).
// onReported gets null when the session moved on without this report.
export function useSpotTakenReport(
  client: ParkingSessionClient,
  target: SpotTakenReportTarget,
  onReported: (response: SpotTakenResponse | null) => void,
): SpotTakenReportController {
  const [attempts, setAttempts] = useState(0);
  const [isUnreachable, setIsUnreachable] = useState(false);
  const { runningKey, run } = useSingleFlight<'report'>();
  const { sessionId, spotNumber } = target;
  const report = useCallback(() => {
    setIsUnreachable(false);
    const onUnreachable = () => {
      setIsUnreachable(true);
      setAttempts((previous) => previous + 1);
    };
    run('report', () => sendReport(() => client.reportSpotTaken(sessionId, spotNumber), { onReported, onUnreachable }));
  }, [client, sessionId, spotNumber, onReported, run]);
  const clearProblem = useCallback(() => setIsUnreachable(false), []);
  return { isSending: runningKey !== null, isUnreachable, attempts, report, clearProblem };
}

async function sendReport(send: () => Promise<SpotTakenResponse>, { onReported, onUnreachable }: ReportHandlers): Promise<void> {
  try {
    onReported(await send());
  } catch (error) {
    const failure = spotTakenFailureOf(error);
    if (failure === 'refresh') {
      onReported(null);
    }
    if (failure === 'unreachable') {
      onUnreachable();
    }
  }
}
