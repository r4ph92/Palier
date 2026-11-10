import type { ExitReceipt } from '@palier/shared-types';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { assertNever } from '../assertNever';
import type { EntryClient } from '../api/EntryClient';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import type { ReceiptClient } from '../api/ReceiptClient';
import { LoadingState } from '../components/LoadingState';
import type { TabLabels } from '../components/TabBar';
import { useEntry, type EntryController, type EntryState } from '../entries/useEntry';
import type { PendingEntryWatch } from '../entries/usePendingEntryWatch';
import { i18n } from '../i18n/i18n';
import type { CurrentParkingSessionController, CurrentParkingSessionReading, CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import { isWalkedAwayState } from '@palier/shared-types/entries';
import { CurrentParkingSessionScreen } from './CurrentParkingSessionScreen';
import { ScanFrame, ScanScreen } from './ScanScreen';
import { SessionNotice } from './SessionNotice';
import { ExitButton, ExitReceiptScreen, PendingReceiptScreen } from './ExitSession';
import { ReportSpotTaken } from './ReportSpotTaken';
import { WhereParkedScreen } from './WhereParkedScreen';

export interface SessionAside {
  readonly detectionNotice: ReactNode;
  readonly guidance: ReactNode;
}

interface ScanTabProps {
  readonly entryClient: EntryClient;
  readonly parkingSessionClient: ParkingSessionClient;
  readonly receiptClient: ReceiptClient;
  readonly gateScanner: (scanner: ReactElement) => ReactElement;
  readonly aside: SessionAside;
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
// Otherwise the tab waits for Palier's first answer, then shows the current session or the form.
export function ScanTab(props: ScanTabProps) {
  const [left, setLeft] = useState<LeftSession | null>(null);
  if (left === null) {
    return <SessionOrScan {...props} onLeft={setLeft} />;
  }
  const onDone = () => setLeft(null);
  // The capture is pending: the screen says the barrier is open and waits for the receipt.
  return left.receipt === null ? (
    <PendingReceiptScreen client={props.receiptClient} sessionId={left.sessionId} onDone={onDone} />
  ) : (
    <ExitReceiptScreen receipt={left.receipt} onDone={onDone} />
  );
}

interface LeftSession {
  readonly sessionId: string;
  // Null while the capture is pending.
  readonly receipt: ExitReceipt | null;
}

interface SessionOrScanProps extends ScanTabProps {
  // The exit took the amount: the receipt replaces the whole tab, the session being closed.
  readonly onLeft: (left: LeftSession) => void;
}

function SessionOrScan({ entryClient, parkingSessionClient, gateScanner, aside, currentSession, pendingEntry, onAddPlate, onAddCard, onLeft }: SessionOrScanProps) {
  const entry = useEntry(entryClient, pendingEntry);
  const { state, refresh, ...progress } = currentSession;
  useRefreshAsEntryProgresses(entry.state, refresh);
  const arrivedParkedSessionId = useEndEntryOnceParked(entry, state);
  const choice = { aside, arrivedParkedSessionId, parkingSessionClient, onLeft };
  const sessionScreen = isEntryInProgress(entry.state) ? null : sessionScreenFor(currentSession, choice);
  if (sessionScreen !== null) {
    return sessionScreen;
  }
  const onDone = () => {
    entry.startOver();
    refresh();
  };
  const notice = <SessionNotice state={state} progress={progress} onRetry={refresh} />;
  return gateScanner(<ScanScreen entry={entry} notice={notice} onDone={onDone} onAddPlate={onAddPlate} onAddCard={onAddCard} />);
}

interface SessionScreenChoice {
  readonly aside: SessionAside;
  // The session the scan result gave way to, whose spot then takes VoiceOver's focus.
  readonly arrivedParkedSessionId: string | null;
  readonly parkingSessionClient: ParkingSessionClient;
  // The exit took the amount: the receipt replaces the session, which Palier has closed.
  readonly onLeft: (left: LeftSession) => void;
}

// What replaces the scan form: nothing yet known, or a current session.
function sessionScreenFor(currentSession: CurrentParkingSessionController, choice: SessionScreenChoice): ReactElement | null {
  const { state } = currentSession;
  switch (state.status) {
    case 'loading':
      return (
        <ScanFrame>
          <LoadingState label={i18n.t('session.loading')} />
        </ScanFrame>
      );
    case 'current':
      return currentSessionScreen(state, currentSession, choice);
    case 'none':
    case 'unknown':
      return null;
    default:
      return assertNever(state);
  }
}

// Once the driver walked away, « présumée occupée après 30 min » would contradict a spot already presumed taken or asked about.
function currentSessionScreen(
  reading: CurrentParkingSessionReading,
  { refresh, isReading, missedReads }: CurrentParkingSessionController,
  { aside, arrivedParkedSessionId, parkingSessionClient, onLeft }: SessionScreenChoice,
): ReactElement {
  return (
    <CurrentParkingSessionScreen
      reading={reading}
      progress={{ isReading, missedReads }} onRetry={refresh}
      notice={isWalkedAwayState(reading.session.state) ? null : aside.detectionNotice}
      guidance={aside.guidance}
      whereParked={(framing) => <WhereParkedScreen client={parkingSessionClient} session={reading.session} framing={framing} onAnswered={refresh} />}
      reportSpotTaken={(onNoneFree) => (
        <ReportSpotTaken key={reading.session.sessionId} client={parkingSessionClient} session={reading.session} onNoneFree={onNoneFree} onSettled={refresh} />
      )}
      exit={exitButtonFor({ client: parkingSessionClient, sessionId: reading.session.sessionId, onLeft, refresh })}
      shouldFocusSpotOnArrival={reading.session.sessionId === arrivedParkedSessionId}
    />
  );
}

interface ExitButtonChoice {
  readonly client: ParkingSessionClient;
  readonly sessionId: string;
  readonly onLeft: (left: LeftSession) => void;
  readonly refresh: () => void;
}

// The receipt shows at once and the session is read again, which now answers none.
function exitButtonFor({ client, sessionId, onLeft, refresh }: ExitButtonChoice): ReactElement {
  const onLeftAndRefresh = (receipt: ExitReceipt | null) => {
    onLeft({ sessionId, receipt });
    refresh();
  };
  return <ExitButton key={sessionId} client={client} sessionId={sessionId} onLeft={onLeftAndRefresh} onSessionMoved={refresh} />;
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

// A walk away from the car can come before « Terminé »: the scan result then gives way to the session parked or asked where it parked,
// and the entry is over, so a later closed session shows the form rather than this entry's spot.
function useEndEntryOnceParked(entry: EntryController, state: CurrentParkingSessionState): string | null {
  const parkedEntrySessionId = parkedEntrySessionIdOf(entry.state, state);
  const arrivedParkedSessionId = useArrivedParkedSessionId(parkedEntrySessionId);
  const { startOver } = entry;
  useEffect(() => {
    if (parkedEntrySessionId !== null) {
      startOver();
    }
  }, [parkedEntrySessionId, startOver]);
  return arrivedParkedSessionId;
}

function parkedEntrySessionIdOf(entryState: EntryState, state: CurrentParkingSessionState): string | null {
  const enteredSessionId = entryState.status === 'entered' ? entryState.sessionId : null;
  const parkedSessionId = state.status === 'current' && isWalkedAwayState(state.session.state) ? state.session.sessionId : null;
  return enteredSessionId !== null && enteredSessionId === parkedSessionId ? enteredSessionId : null;
}

// Kept once the entry ends, which forgets the entered session id.
function useArrivedParkedSessionId(parkedEntrySessionId: string | null): string | null {
  const [arrivedParkedSessionId, setArrivedParkedSessionId] = useState<string | null>(null);
  if (parkedEntrySessionId !== null && parkedEntrySessionId !== arrivedParkedSessionId) {
    setArrivedParkedSessionId(parkedEntrySessionId);
  }
  return arrivedParkedSessionId;
}
