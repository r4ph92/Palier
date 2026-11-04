import type { CurrentParkingSession } from '@palier/shared-types';
import { ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { SpotWithState } from '../components/SpotLine';
import { formatClockTime } from '../i18n/formatClockTime';
import { formatElapsed } from '../i18n/formatElapsed';
import { formatMoney } from '../i18n/formatMoney';
import { currentLanguage, i18n } from '../i18n/i18n';
import type { CurrentParkingSessionReading } from '../parkingSessions/useCurrentParkingSession';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { OfflineNotice } from './SessionNotice';

interface CurrentParkingSessionScreenProps {
  // Carries when the app last heard from Palier, so a driver without signal knows how old the amount is.
  readonly reading: CurrentParkingSessionReading;
  readonly onRetry: () => void;
}

// Everything shown comes from the API, priced by its clock; the screen never counts time on its own.
export function CurrentParkingSessionScreen({ reading, onRetry }: CurrentParkingSessionScreenProps) {
  const colors = useColors();
  const language = currentLanguage();
  const { session, readAt } = reading;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow={i18n.t('session.eyebrow')} title={session.lotName} />
        <SessionSpot session={session} />
        {reading.isStale ? <OfflineNotice onRetry={onRetry} /> : null}
        <SessionAmount session={session} />
        <View>
          <FigureRow lead={i18n.t('session.enteredLead')} value={formatClockTime(new Date(session.enteredAt), language)} />
          <FigureRow lead={i18n.t('session.elapsedLead')} value={formatElapsed(session.elapsedMinutes, language)} />
        </View>
        <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('session.updatedAt', { time: formatClockTime(readAt, language) })}</Text>
      </ScrollView>
    </SafeAreaView>
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

function SessionSpot({ session }: { readonly session: CurrentParkingSession }) {
  const colors = useColors();
  const isConfirmed = session.state === 'ENTRY_CONFIRMED';
  const status = i18n.t(isConfirmed ? 'scan.entryConfirmed' : 'session.pending');
  return <SpotWithState spot={session.spot} status={status} markColor={isConfirmed ? colors.free : colors.muted} />;
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
