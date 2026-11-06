import type { ReactNode } from 'react';
import { assertNever } from '../assertNever';
import type { BackgroundLocationClient } from '../deviceLocation/BackgroundLocationClient';
import type { LocationExplanationStore } from '../deviceLocation/LocationExplanationStore';
import { useLocationExplanation } from '../deviceLocation/useLocationExplanation';
import { LocationExplanationScreen } from './LocationExplanationScreen';
import { ScanFrame } from './ScanScreen';

interface ScannerGateProps {
  readonly store: LocationExplanationStore;
  readonly location: BackgroundLocationClient;
  readonly children: ReactNode;
}

// The first time on a device, the « Always » explanation comes before the scanner, whatever the driver then answers to iOS.
export function ScannerGate({ store, location, children }: ScannerGateProps) {
  const { state, continueToPrompt, continueWithout } = useLocationExplanation(store, location);
  switch (state.status) {
    case 'reading':
      return <ScanFrame>{null}</ScanFrame>;
    case 'answered':
      return children;
    case 'unanswered':
    case 'prompting':
      return <LocationExplanationScreen isPrompting={state.status === 'prompting'} onContinue={continueToPrompt} onContinueWithout={continueWithout} />;
    default:
      return assertNever(state);
  }
}
