import type { CurrentParkingSession, EntrySessionState } from '@palier/shared-types';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatClockTime } from '../i18n/formatClockTime';
import { formatElapsed } from '../i18n/formatElapsed';
import { formatMoney } from '../i18n/formatMoney';
import { currentLanguage, i18n } from '../i18n/i18n';
import type { CurrentParkingSessionReading, ReadProgress } from '../parkingSessions/useCurrentParkingSession';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { canCorrect, CorrectSpotButton, useSpotCorrection, type SpotCorrection } from './CorrectSpot';
import { OfflineNotice } from './OfflineNotice';
import { SessionSpot, useParkedArrival, type ParkedArrival } from './SessionSpot';
import type { WhereParkedFraming } from './WhereParkedScreen';

interface CurrentParkingSessionScreenProps {
  // Carries when the app last heard from Palier, so a driver without signal knows how old the amount is.
  readonly reading: CurrentParkingSessionReading;
  readonly progress: ReadProgress;
  readonly onRetry: () => void;
  readonly notice?: ReactNode;
  readonly guidance?: ReactNode;
  // Asks where the car is in place of the details: while the session is PARKED_UNCONFIRMED, or while the driver corrects a presumed spot.
  readonly whereParked?: (framing: WhereParkedFraming) => ReactNode;
  // The scan result holding VoiceOver's focus gave way to this screen: the focus moves to the spot.
  readonly shouldFocusSpotOnArrival?: boolean;
}

// Everything shown comes from the API, priced by its clock; the screen never counts time on its own.
export function CurrentParkingSessionScreen(props: CurrentParkingSessionScreenProps) {
  const colors = useColors();
  const { reading, progress, onRetry } = props;
  const arrival = useParkedArrival(reading.session);
  const correction = useSpotCorrection(reading.session);
  const offline = reading.isStale ? <OfflineNotice message={offlineMessageOf(reading.session)} progress={progress} onRetry={onRetry} /> : null;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader eyebrow={i18n.t('session.eyebrow')} title={reading.session.lotName} />
        <SessionBody {...props} offline={offline} arrival={arrival} correction={correction} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface SessionDetailsProps extends CurrentParkingSessionScreenProps {
  readonly offline: ReactNode;
  readonly arrival: ParkedArrival;
  readonly correction: SpotCorrection;
}

type SessionView = 'question' | 'correction' | 'details';

// The form replaces the details: A-1, its guidance and the figures would pull the driver away from the one answer asked.
function sessionViewOf(state: EntrySessionState, isCorrecting: boolean): SessionView {
  if (state === 'PARKED_UNCONFIRMED') {
    return 'question';
  }
  return canCorrect(state) && isCorrecting ? 'correction' : 'details';
}

function SessionBody(props: SessionDetailsProps) {
  const view = sessionViewOf(props.reading.session.state, props.correction.isCorrecting);
  if (view === 'details') {
    return <SessionDetails {...props} />;
  }
  return <>{props.whereParked?.(framingOf(view, props))}</>;
}

// A correction has no free spot list nor amount, so the offline notice of either would speak of something not shown.
function framingOf(view: Exclude<SessionView, 'details'>, { offline, correction }: SessionDetailsProps): WhereParkedFraming {
  if (view === 'question') {
    return { title: i18n.t('session.whereParked.question'), numberLabel: i18n.t('session.whereParked.numberLabel'), offline };
  }
  return {
    title: i18n.t('session.whereParked.notMySpot'),
    numberLabel: i18n.t('session.whereParked.correctedNumberLabel'),
    offline: null,
    onCancel: correction.cancel,
  };
}

// The question shows free spots, not an amount: its notice says which figures are old.
function offlineMessageOf(session: CurrentParkingSession): string {
  return i18n.t(session.state === 'PARKED_UNCONFIRMED' ? 'session.whereParked.offline' : 'session.offline');
}

function SessionDetails({ reading, offline, arrival, correction, notice, guidance, shouldFocusSpotOnArrival = false }: SessionDetailsProps) {
  const { session, readAt } = reading;
  return (
    <>
      <SessionSpot session={session} arrival={arrival} shouldFocusOnArrival={shouldFocusSpotOnArrival} />
      {canCorrect(session.state) ? <CorrectSpotButton correction={correction} /> : null}
      {guidance}
      {offline}
      {notice}
      <SessionAmount session={session} />
      <SessionTimes session={session} />
      <UpdatedAt readAt={readAt} />
    </>
  );
}

function SessionTimes({ session }: { readonly session: CurrentParkingSession }) {
  const language = currentLanguage();
  return (
    <View>
      <FigureRow lead={i18n.t('session.enteredLead')} value={formatClockTime(new Date(session.enteredAt), language)} />
      <FigureRow lead={i18n.t('session.elapsedLead')} value={formatElapsed(session.elapsedMinutes, language)} />
    </View>
  );
}

// The time is a figure like the others, in mono (gesture 3), inside a muted sentence.
function UpdatedAt({ readAt }: { readonly readAt: Date }) {
  const colors = useColors();
  return (
    <Text style={[typography.body, { color: colors.muted }]}>
      {i18n.t('session.updatedAtLead')}
      <Text style={typography.figure}>{formatClockTime(readAt, currentLanguage())}</Text>
    </Text>
  );
}

// After the spot, the amount is what the driver came for: the largest figure, with the cap it never exceeds.
function SessionAmount({ session }: { readonly session: CurrentParkingSession }) {
  const language = currentLanguage();
  return (
    <View style={styles.group}>
      <Figure lead={i18n.t('session.amountLead')} value={formatMoney(session.amountCents, language)} leadStyle={typography.bodyStrong} valueStyle={typography.countNumber} />
      <Figure lead={i18n.t('session.capLead')} value={formatMoney(session.dailyCapCents, language)} />
    </View>
  );
}

interface FigureProps {
  readonly lead: string;
  readonly value: string;
  readonly leadStyle?: TextStyle;
  readonly valueStyle?: TextStyle;
}

// One sentence, so VoiceOver reads « Montant à ce jour : 9,75 $ » together; the figure itself is in mono (gesture 3).
function Figure({ lead, value, leadStyle = typography.body, valueStyle = typography.figure }: FigureProps) {
  const colors = useColors();
  return (
    <Text style={[leadStyle, { color: colors.ink }]}>
      {lead}
      <Text style={valueStyle}>{value}</Text>
    </Text>
  );
}

// List lines are separated by thin rules, without cards (docs/design.md, gesture 2).
function FigureRow({ lead, value }: Pick<FigureProps, 'lead' | 'value'>) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <Figure lead={lead} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.large, paddingHorizontal: spacing.medium, paddingBottom: spacing.large },
  group: { gap: spacing.small },
  row: { paddingVertical: spacing.small, borderBottomWidth: StyleSheet.hairlineWidth },
});
