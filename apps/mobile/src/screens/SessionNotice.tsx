import { StyleSheet, Text, View } from 'react-native';
import { assertNever } from '../assertNever';
import { TextButton } from '../components/TextButton';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { CurrentParkingSessionState, ReadProgress } from '../parkingSessions/useCurrentParkingSession';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface SessionNoticeProps {
  readonly state: CurrentParkingSessionState;
  readonly progress: ReadProgress;
  readonly onRetry: () => void;
}

// Above the scan form: what Palier said about a current session, so a driver already inside is never left guessing.
// Loading and current sessions have their own screens, so they show nothing here.
export function SessionNotice({ state, progress, onRetry }: SessionNoticeProps) {
  switch (state.status) {
    case 'none':
      return <MutedLine text={i18n.t('session.none')} />;
    case 'unknown':
      return <CheckFailedNotice progress={progress} onRetry={onRetry} />;
    case 'loading':
    case 'current':
      return null;
    default:
      return assertNever(state);
  }
}

function CheckFailedNotice({ progress, onRetry }: { readonly progress: ReadProgress; readonly onRetry: () => void }) {
  const message = i18n.t('session.checkFailed');
  useAnnouncement(message, progress.missedReads);
  return (
    <View style={styles.withAction}>
      <MutedLine text={message} />
      <TextButton label={i18n.t('scan.retry')} busyLabel={i18n.t('session.checking')} onPress={onRetry} isBusy={progress.isReading} />
    </View>
  );
}

function MutedLine({ text }: { readonly text: string }) {
  const colors = useColors();
  return <Text style={[typography.body, { color: colors.muted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  withAction: { alignItems: 'flex-start' },
});
