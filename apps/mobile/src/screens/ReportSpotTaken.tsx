import type { AssignedSpot, CurrentParkingSession, EntrySessionState, SpotTakenResponse } from '@palier/shared-types';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { FieldError } from '../components/FieldError';
import { PrimaryButton } from '../components/PrimaryButton';
import { SpotNumberText } from '../components/SpotNumberText';
import { TextButton } from '../components/TextButton';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import { unbrokenSpotNumber } from '../spots/spotNumber';
import { useSpotTakenReport, type SpotTakenReportController } from '../parkingSessions/useSpotTakenReport';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export function canReportSpotTaken(state: EntrySessionState): boolean {
  return state === 'ENTRY_CONFIRMED';
}

export interface NoneFreeNotice {
  readonly isShown: boolean;
  show(): void;
}

// Held above the question, which replaces the details once no other spot is free; it goes when the session leaves the question.
export function useNoneFreeNotice({ sessionId, state }: CurrentParkingSession): NoneFreeNotice {
  const [shownForSessionId, setShownForSessionId] = useState<string | null>(null);
  const [previousState, setPreviousState] = useState(state);
  if (state !== previousState) {
    setPreviousState(state);
    if (previousState === 'PARKED_UNCONFIRMED') {
      setShownForSessionId(null);
    }
  }
  return { isShown: shownForSessionId === sessionId, show: () => setShownForSessionId(sessionId) };
}

// idle: the action without focus, as first shown or once a report settled (the next view takes VoiceOver: the new spot, the question);
// confirming: the question replaces it; returned: the action after « Garder », which takes VoiceOver back.
type ReportStep = 'idle' | 'confirming' | 'returned';

interface ReportSpotTakenProps {
  readonly client: ParkingSessionClient;
  readonly session: CurrentParkingSession;
  // No other spot fits: the screen tells the driver why it now asks where they parked.
  readonly onNoneFree: () => void;
  // Reads the session again: the new spot, the question, or whatever the session became without this report.
  readonly onSettled: () => void;
}

export function ReportSpotTaken({ client, session, onNoneFree, onSettled }: ReportSpotTakenProps) {
  const [step, setStep] = useState<ReportStep>('idle');
  const onReported = useSettledReport({ onNoneFree, onSettled }, setStep);
  const reporting = useSpotTakenReport(client, { sessionId: session.sessionId, spotNumber: session.spot.number }, onReported);
  if (step !== 'confirming') {
    return <ReportButton takesFocus={step === 'returned'} onPress={() => setStep('confirming')} />;
  }
  const keepSpot = () => {
    reporting.clearProblem();
    setStep('returned');
  };
  return <ConfirmReport spot={session.spot} reporting={reporting} onCancel={keepSpot} />;
}

function useSettledReport({ onNoneFree, onSettled }: Pick<ReportSpotTakenProps, 'onNoneFree' | 'onSettled'>, setStep: (step: ReportStep) => void) {
  return useCallback(
    (response: SpotTakenResponse | null) => {
      if (response?.outcome === 'none-free') {
        onNoneFree();
      }
      setStep('idle');
      onSettled();
    },
    [onNoneFree, onSettled, setStep],
  );
}

function ReportButton({ takesFocus, onPress }: { readonly takesFocus: boolean; readonly onPress: () => void }) {
  const focusRef = useAccessibilityFocusOnMount();
  return <TextButton label={i18n.t('session.spotTaken.action')} align="start" focusRef={takesFocus ? focusRef : undefined} onPress={onPress} />;
}

interface ConfirmReportProps {
  readonly spot: AssignedSpot;
  readonly reporting: SpotTakenReportController;
  readonly onCancel: () => void;
}

// A report moves the driver to another spot at once, so it is confirmed first; a report in flight cannot be cancelled.
function ConfirmReport({ spot, reporting, onCancel }: ConfirmReportProps) {
  const cancel = reporting.isSending ? undefined : onCancel;
  const number = unbrokenSpotNumber(spot);
  return (
    <View style={styles.group} onAccessibilityEscape={cancel}>
      <ConfirmQuestion spot={spot} />
      <ReportProblem isUnreachable={reporting.isUnreachable} attempts={reporting.attempts} />
      <PrimaryButton
        label={i18n.t('session.spotTaken.confirm', { number })}
        busyLabel={i18n.t('session.spotTaken.sending')}
        busy={reporting.isSending}
        onPress={reporting.report}
      />
      {cancel === undefined ? null : <TextButton label={i18n.t('session.spotTaken.cancel', { number })} align="start" onPress={cancel} />}
    </View>
  );
}

// The pressed action is gone, so VoiceOver moves to the question; the spot number is a figure, in mono (docs/design.md, gesture 3).
function ConfirmQuestion({ spot }: { readonly spot: AssignedSpot }) {
  const colors = useColors();
  const focusRef = useAccessibilityFocusOnMount();
  return (
    <View ref={focusRef} accessible>
      <SpotNumberText
        spot={spot}
        lead={i18n.t('session.spotTaken.confirmLead')}
        trail={i18n.t('session.spotTaken.confirmTrail')}
        style={[typography.bodyStrong, { color: colors.ink }]}
        numberStyle={typography.figureStrong}
      />
    </View>
  );
}

// Announced on every report Palier did not get, the same one twice included, since the focus stays on « Confirmer ».
function ReportProblem({ isUnreachable, attempts }: { readonly isUnreachable: boolean; readonly attempts: number }) {
  const message = isUnreachable ? i18n.t('session.spotTaken.unreachable') : null;
  useAnnouncement(message, attempts);
  return message === null ? null : <FieldError message={message} />;
}

const styles = StyleSheet.create({
  group: { gap: spacing.medium },
});
