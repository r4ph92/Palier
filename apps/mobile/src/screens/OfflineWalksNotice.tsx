import { Text } from 'react-native';
import { StateMark } from '../components/StateMark';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { OfflineWalks } from '../parkingSessions/useOfflineWalks';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface OfflineWalksNoticeProps {
  readonly walks: OfflineWalks;
}

// A walk still waiting outweighs one just sent: the driver needs to know the spot is not recorded yet.
function messageOf({ pending, sent }: OfflineWalks): string | null {
  if (pending > 0) {
    return i18n.t('session.offlineWalks.pending', { count: pending });
  }
  return sent > 0 ? i18n.t('session.offlineWalks.sent', { count: sent }) : null;
}

// On the session screen, beside « Hors ligne, montant au dernier relevé »; queued so neither cuts the other off.
export function OfflineWalksNotice({ walks }: OfflineWalksNoticeProps) {
  const colors = useColors();
  const message = messageOf(walks);
  useAnnouncement(message, 0, { queued: true });
  if (message === null) {
    return null;
  }
  return (
    <StateMark color={walks.pending > 0 ? colors.muted : colors.free}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{message}</Text>
    </StateMark>
  );
}
