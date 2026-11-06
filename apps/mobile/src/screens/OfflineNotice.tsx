import { Text } from 'react-native';
import { NoticeWithAction } from '../components/NoticeWithAction';
import { StateMark } from '../components/StateMark';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { ReadProgress } from '../parkingSessions/useCurrentParkingSession';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface OfflineNoticeProps {
  // Says which figures are those of the last read.
  readonly message: string;
  readonly progress: ReadProgress;
  readonly onRetry: () => void;
}

// On the session screen after a missed refresh: the figures stay, marked as those of the last read.
export function OfflineNotice({ message, progress, onRetry }: OfflineNoticeProps) {
  const colors = useColors();
  useAnnouncement(message, progress.missedReads);
  return (
    <NoticeWithAction
      message={
        <StateMark color={colors.muted}>
          <Text style={[typography.bodyStrong, { color: colors.ink }]}>{message}</Text>
        </StateMark>
      }
      action={{ label: i18n.t('scan.retry'), busyLabel: i18n.t('session.checking'), onPress: onRetry, isBusy: progress.isReading }}
    />
  );
}
