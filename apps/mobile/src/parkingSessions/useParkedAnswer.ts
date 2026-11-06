import { useCallback, useState } from 'react';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { useSingleFlight } from '../useSingleFlight';
import { parkedAnswerOutcomeOf, type ParkedAnswerProblem } from './parkedAnswerOutcome';

export interface ParkedAnswerController {
  readonly isSending: boolean;
  readonly problem: ParkedAnswerProblem | null;
  // Grows with every refused answer, so the same problem twice is announced twice.
  readonly attempts: number;
  answer(spotNumber: string): void;
  // A refusal was about the number sent; once the driver changes it, the message no longer applies.
  clearProblem(): void;
}

interface AnswerState {
  readonly problem: ParkedAnswerProblem | null;
  readonly attempts: number;
}

interface AnswerHandlers {
  readonly onSettled: () => void;
  readonly onProblem: (problem: ParkedAnswerProblem) => void;
}

// One answer at a time; an accepted one, or a session that moved on, reads the session again (« Garé en B-3 »).
export function useParkedAnswer(client: ParkingSessionClient, sessionId: string, onSettled: () => void): ParkedAnswerController {
  const [state, setState] = useState<AnswerState>({ problem: null, attempts: 0 });
  const { runningKey, run } = useSingleFlight<'answer'>();
  const answer = useCallback(
    (spotNumber: string) => {
      const onProblem = (problem: ParkedAnswerProblem) => setState((previous) => ({ problem, attempts: previous.attempts + 1 }));
      run('answer', () => sendAnswer(() => client.answerParkedSpot(sessionId, spotNumber), { onSettled, onProblem }));
    },
    [client, sessionId, onSettled, run],
  );
  const clearProblem = useCallback(() => setState((previous) => (previous.problem === null ? previous : { ...previous, problem: null })), []);
  return { isSending: runningKey !== null, problem: state.problem, attempts: state.attempts, answer, clearProblem };
}

async function sendAnswer(send: () => Promise<unknown>, { onSettled, onProblem }: AnswerHandlers): Promise<void> {
  try {
    await send();
    onSettled();
  } catch (error) {
    const outcome = parkedAnswerOutcomeOf(error);
    if (outcome.kind === 'refresh') {
      onSettled();
    }
    if (outcome.kind === 'problem') {
      onProblem(outcome.problem);
    }
  }
}
