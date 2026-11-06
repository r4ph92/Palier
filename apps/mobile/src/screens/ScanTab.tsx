import { useEffect, type ReactElement } from 'react';
import { assertNever } from '../assertNever';
import type { EntryClient } from '../api/EntryClient';
import { LoadingState } from '../components/LoadingState';
import type { TabLabels } from '../components/TabBar';
import { useEntry, type EntryState } from '../entries/useEntry';
import type { PendingEntryWatch } from '../entries/usePendingEntryWatch';
import type { BackgroundLocationClient } from '../deviceLocation/BackgroundLocationClient';
import type { LocationExplanationStore } from '../deviceLocation/LocationExplanationStore';
import { useLocationExplanation, type LocationExplanationController } from '../deviceLocation/useLocationExplanation';
import { i18n } from '../i18n/i18n';
import type { CurrentParkingSessionController, CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import { AutomaticDetectionNotice } from './AutomaticDetectionNotice';
import { CurrentParkingSessionScreen } from './CurrentParkingSessionScreen';
import { LocationExplanationScreen } from './LocationExplanationScreen';
import { ScanFrame, ScanScreen } from './ScanScreen';
import { SessionNotice } from './SessionNotice';

interface ScanTabProps {
  readonly entryClient: EntryClient;
  readonly location: BackgroundLocationClient;
  readonly locationExplanation: LocationExplanationStore;
  readonly currentSession: CurrentParkingSessionController;
  readonly pendingEntry: PendingEntryWatch;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

// While a session is current this tab hosts it, so the tab bar names it « Session ».
export function scanTabLabels(state: CurrentParkingSessionState): TabLabels {
  return state.status === 'current' ? { scan: i18n.t('tabs.session') } : {};
}

// An entry in progress keeps the scan screen, so its spot and announcement are never cut off by a refresh.
// Otherwise the tab waits for Palier's first answer, then shows the current session or the form;
// the first time on a device, the « Always » explanation comes before the form.
export function ScanTab({ entryClient, location, locationExplanation, currentSession, pendingEntry, onAddPlate, onAddCard }: ScanTabProps) {
  const entry = useEntry(entryClient, pendingEntry);
  const explanation = useLocationExplanation(locationExplanation, location);
  const { state, refresh, ...progress } = currentSession;
  useRefreshAsEntryProgresses(entry.state, refresh);
  const inProgress = isEntryInProgress(entry.state);
  const screenInTheWay = inProgress ? null : (sessionScreenFor(currentSession, location) ?? explanationScreenFor(explanation));
  if (screenInTheWay !== null) {
    return screenInTheWay;
  }
  const onDone = () => {
    entry.startOver();
    refresh();
  };
  const notice = <SessionNotice state={state} progress={progress} onRetry={refresh} />;
  return <ScanScreen entry={entry} notice={notice} onDone={onDone} onAddPlate={onAddPlate} onAddCard={onAddCard} />;
}

// What replaces the scan form: nothing yet known, or a current session.
function sessionScreenFor({ state, refresh, ...progress }: CurrentParkingSessionController, location: BackgroundLocationClient): ReactElement | null {
  switch (state.status) {
    case 'loading':
      return <LoadingScanFrame />;
    case 'current':
      return <CurrentParkingSessionScreen reading={state} progress={progress} onRetry={refresh} notice={<AutomaticDetectionNotice location={location} />} />;
    case 'none':
    case 'unknown':
      return null;
    default:
      return assertNever(state);
  }
}

// The explanation waits for the flag to be read, then stays until the driver answers.
function explanationScreenFor({ state, continueToPrompt, continueWithout }: LocationExplanationController): ReactElement | null {
  switch (state.status) {
    case 'reading':
      return <LoadingScanFrame />;
    case 'answered':
      return null;
    case 'unanswered':
    case 'prompting':
      return <LocationExplanationScreen isPrompting={state.status === 'prompting'} onContinue={continueToPrompt} onContinueWithout={continueWithout} />;
    default:
      return assertNever(state);
  }
}

function LoadingScanFrame() {
  return (
    <ScanFrame>
      <LoadingState label={i18n.t('session.loading')} />
    </ScanFrame>
  );
}

// A cancelled entry keeps the scan screen too: its message stays on the form, whatever the session read answers.
function isEntryInProgress(state: EntryState): boolean {
  return state.status === 'submitting' || state.status === 'entered' || state.status === 'cancelled';
}

// The tab label turns to « Session » as soon as the barrier opens, and the state follows the loop confirmation; the watch refreshes on a cancellation.
function useRefreshAsEntryProgresses(state: EntryState, refresh: () => void): void {
  const progress = progressKey(state);
  useEffect(() => {
    if (progress !== null) {
      refresh();
    }
  }, [progress, refresh]);
}

function progressKey(state: EntryState): string | null {
  return state.status === 'entered' ? `${state.sessionId}:${String(state.isConfirmed)}` : null;
}
