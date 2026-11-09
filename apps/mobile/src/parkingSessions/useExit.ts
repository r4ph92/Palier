import type { ExitReceipt } from "@palier/shared-types";
import { useCallback, useState } from "react";
import { PalierUnauthorizedError } from "../api/AuthClient";
import { PalierUnreachableError } from "../api/LotsClient";
import type { ParkingSessionClient } from "../api/ParkingSessionClient";
import {
  PalierConsentRequiredError,
  PalierRejectedError,
} from "../api/VehicleClient";
import { useSingleFlight } from "../useSingleFlight";

export interface ExitController {
  readonly isSending: boolean;
  readonly isUnreachable: boolean;
  // Grows with every tap Palier did not get, so the same message twice is announced twice.
  readonly attempts: number;
  leave(): void;
}

interface ExitHandlers {
  readonly onLeft: (receipt: ExitReceipt) => void;
  // The session moved on without this tap (closed, unknown): the screen reads it again.
  readonly onSessionMoved: () => void;
}

// One tap at a time; Palier answers a repeated tap with the first receipt, so a lost answer is safe to ask again.
export function useExit(client: ParkingSessionClient, sessionId: string, handlers: ExitHandlers): ExitController {
  const [problem, setProblem] = useState({ isUnreachable: false, attempts: 0 });
  const { runningKey, run } = useSingleFlight<'exit'>();
  const { onLeft, onSessionMoved } = handlers;
  const leave = useCallback(() => {
    setProblem((previous) => ({ ...previous, isUnreachable: false }));
    const onUnreachable = () => setProblem((previous) => ({ isUnreachable: true, attempts: previous.attempts + 1 }));
    run('exit', () => sendExit(() => client.exit(sessionId), { onLeft, onSessionMoved, onUnreachable }));
  }, [client, sessionId, onLeft, onSessionMoved, run]);
  return { isSending: runningKey !== null, ...problem, leave };
}

interface ExitSendHandlers extends ExitHandlers {
  readonly onUnreachable: () => void;
}

async function sendExit(
  send: () => ReturnType<ParkingSessionClient["exit"]>,
  handlers: ExitSendHandlers,
): Promise<void> {
  try {
    handlers.onLeft((await send()).receipt);
  } catch (error) {
    const failure = exitFailureOf(error);
    if (failure === "moved") {
      handlers.onSessionMoved();
    }
    if (failure === "unreachable") {
      handlers.onUnreachable();
    }
  }
}

// moved: Palier refused the tap, the session being closed or unknown; silent: a refused token or a missing notice already moved
// the app off the tabs; unreachable: no answer, a busy lot or a card Stripe could not charge now, the driver can tap again.
type ExitFailure = "moved" | "silent" | "unreachable";

function exitFailureOf(error: unknown): ExitFailure {
  if (error instanceof PalierRejectedError) {
    return "moved";
  }
  if (
    error instanceof PalierUnauthorizedError ||
    error instanceof PalierConsentRequiredError
  ) {
    return "silent";
  }
  if (!(error instanceof PalierUnreachableError)) {
    console.error("Leaving the parking failed", error);
  }
  return "unreachable";
}
