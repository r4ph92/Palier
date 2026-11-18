import type { SpotTakenResponse } from '@palier/shared-types';
import { useCallback, useState } from 'react';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { useSingleFlight } from '../useSingleFlight';
import { spotTakenFailureOf } from './spotTakenOutcome';

export type SpotTakenProblem = 'unreachable' | 'limit';

export interface SpotTakenReportController {
  readonly isSending: boolean;
  readonly problem: SpotTakenProblem | null;
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
  readonly onProblem: (problem: SpotTakenProblem) => void;
}

// One report at a time; any answer that settles it reads the session again (the new spot, or the question).
// onReported gets null when the session moved on without this report.
export function useSpotTakenReport(
  client: ParkingSessionClient,
  target: SpotTakenReportTarget,
  onReported: (response: SpotTakenResponse | null) => void,
): SpotTakenReportController {
  const [attempts, setAttempts] = useState(0);
  const [problem, setProblem] = useState<SpotTakenProblem | null>(null);
  const { runningKey, run } = useSingleFlight<'report'>();
  const { sessionId, spotNumber } = target;
  const report = useCallback(() => {
    setProblem(null);
    const onProblem = (reason: SpotTakenProblem) => {
      setProblem(reason);
      setAttempts((previous) => previous + 1);
    };
    run('report', () => sendReport(() => client.reportSpotTaken(sessionId, spotNumber), { onReported, onProblem }));
  }, [client, sessionId, spotNumber, onReported, run]);
  const clearProblem = useCallback(() => setProblem(null), []);
  return { isSending: runningKey !== null, problem, attempts, report, clearProblem };
}

async function sendReport(send: () => Promise<SpotTakenResponse>, { onReported, onProblem }: ReportHandlers): Promise<void> {
  try {
    onReported(await send());
  } catch (error) {
    const failure = spotTakenFailureOf(error);
    if (failure === 'refresh') {
      onReported(null);
    }
    if (failure === 'unreachable' || failure === 'limit') {
      onProblem(failure);
    }
  }
}
