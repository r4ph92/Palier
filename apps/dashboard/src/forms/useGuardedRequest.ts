import { useRef, useState } from 'react';

export interface GuardedRequest {
  readonly busy: boolean;
  // Ignored while the previous request is on its way.
  readonly run: (request: () => Promise<void>) => Promise<void>;
}

// A ref, not state, guards the request: clicks in the same instant all see the state of the render before the first one.
export function useGuardedRequest(): GuardedRequest {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async (request: () => Promise<void>) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await request();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { busy, run };
}
