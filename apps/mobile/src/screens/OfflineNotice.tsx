import { StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { TextButton } from '../components/TextButton';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { ReadProgress } from '../parkingSessions/useCurrentParkingSession';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface OfflineNoticeProps {
  readonly progress: ReadProgress;
  readonly onRetry: () => void;
}

// On the session screen after a missed refresh: the figures stay, marked as those of the last read.
export function OfflineNotice({ progress, onRetry }: OfflineNoticeProps) {
  const colors = useColors();
  const message = i18n.t('session.offline');
  useAnnouncement(message, progress.missedReads);
  return (
    <View style={styles.withAction}>
      <StateMark color={colors.muted}>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>{message}</Text>
      </StateMark>
      <TextButton label={i18n.t('scan.retry')} busyLabel={i18n.t('session.checking')} onPress={onRetry} isBusy={progress.isReading} />
    </View>
  );
}

const styles = StyleSheet.create({
  withAction: { alignItems: 'flex-start' },
});
