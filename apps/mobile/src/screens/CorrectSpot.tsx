import type { CurrentParkingSession } from '@palier/shared-types';
import { useState } from 'react';
import { TextButton } from '../components/TextButton';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { i18n } from '../i18n/i18n';

// idle: the action as first shown; correcting: the form replaces the details; cancelled: the action again, which takes VoiceOver back.
type CorrectionStep = 'idle' | 'correcting' | 'cancelled';

export interface SpotCorrection {
  readonly isCorrecting: boolean;
  readonly takesFocus: boolean;
  start(): void;
  cancel(): void;
}

// Held above the details, which the form unmounts while the driver corrects the spot; another session, or the same one moved on, starts idle.
export function useSpotCorrection({ sessionId, state }: CurrentParkingSession): SpotCorrection {
  const [step, setStep] = useState<CorrectionStep>('idle');
  const sessionKey = `${sessionId}:${state}`;
  const [stepSessionKey, setStepSessionKey] = useState(sessionKey);
  if (sessionKey !== stepSessionKey) {
    setStepSessionKey(sessionKey);
    setStep('idle');
  }
  return {
    isCorrecting: step === 'correcting',
    takesFocus: step === 'cancelled',
    start: () => setStep('correcting'),
    cancel: () => setStep('cancelled'),
  };
}

export function CorrectSpotButton({ correction }: { readonly correction: SpotCorrection }) {
  const focusRef = useAccessibilityFocusOnMount();
  return <TextButton label={i18n.t('session.whereParked.notMySpot')} align="start" focusRef={correction.takesFocus ? focusRef : undefined} onPress={correction.start} />;
}
