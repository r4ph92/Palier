import { Text } from 'react-native';
import { StateMark } from '../components/StateMark';
import { useAnnouncement } from '../components/useAnnouncement';
import { i18n } from '../i18n/i18n';
import type { ParkedSignalBanner } from '../parkingSessions/useParkedSignalBanner';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

// On the session screen: the walk away is kept while the network is down, then reported once it is back.
export function ParkedSignalNotice({ banner }: { readonly banner: ParkedSignalBanner | null }) {
  const colors = useColors();
  const message =
    banner === null
      ? null
      : i18n.t(banner.kind === 'waiting' ? 'session.whereParked.signalsWaiting' : 'session.whereParked.signalsSent', { count: banner.count });
  useAnnouncement(message, banner?.count ?? 0, { queued: true });
  if (message === null) {
    return null;
  }
  return (
    <StateMark color={colors.muted}>
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{message}</Text>
    </StateMark>
  );
}
