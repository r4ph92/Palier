import { useEffect } from 'react';
import { Text } from 'react-native';
import type { EntryClient } from '../api/EntryClient';
import type { TabLabels } from '../components/TabBar';
import { useEntry, type EntryState } from '../entries/useEntry';
import { i18n } from '../i18n/i18n';
import type { CurrentParkingSessionController, CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { CurrentParkingSessionScreen } from './CurrentParkingSessionScreen';
import { ScanScreen } from './ScanScreen';

interface ScanTabProps {
  readonly entryClient: EntryClient;
  readonly currentSession: CurrentParkingSessionController;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

// While a session is current this tab hosts it, so the tab bar names it « Session ».
export function scanTabLabels(state: CurrentParkingSessionState): TabLabels {
  return state.status === 'current' ? { scan: i18n.t('tabs.session') } : {};
}

// An entry in progress keeps the scan screen, so its spot, polling and announcement are never cut off by a refresh.
// Otherwise a current session replaces the form; without one, the form shows.
export function ScanTab({ entryClient, currentSession, onAddPlate, onAddCard }: ScanTabProps) {
  const entry = useEntry(entryClient);
  const { state, refresh } = currentSession;
  useRefreshAsEntryProgresses(entry.state, refresh);
  if (isEntryInProgress(entry.state) || state.status !== 'current') {
    const onDone = () => {
      entry.startOver();
      refresh();
    };
    return <ScanScreen entry={entry} notice={<SessionNotice state={state} />} onDone={onDone} onAddPlate={onAddPlate} onAddCard={onAddCard} />;
  }
  return <CurrentParkingSessionScreen session={state.session} readAt={state.readAt} />;
}

// Said only once Palier answered that the driver has no session; nothing while loading or unreachable.
function SessionNotice({ state }: { readonly state: CurrentParkingSessionState }) {
  const colors = useColors();
  if (state.status !== 'none') {
    return null;
  }
  return <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('session.none')}</Text>;
}

function isEntryInProgress(state: EntryState): boolean {
  return state.status === 'submitting' || state.status === 'entered';
}

// The tab label turns to « Session » as soon as the barrier opens, and the state follows the loop confirmation.
function useRefreshAsEntryProgresses(state: EntryState, refresh: () => void): void {
  const progress = state.status === 'entered' ? `${state.sessionId}:${String(state.isConfirmed)}` : null;
  useEffect(() => {
    if (progress !== null) {
      refresh();
    }
  }, [progress, refresh]);
}
