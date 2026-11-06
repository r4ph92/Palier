import { Linking, Text } from 'react-native';
import { NoticeWithAction } from '../components/NoticeWithAction';
import { StateMark } from '../components/StateMark';
import { useAnnouncement } from '../components/useAnnouncement';
import type { BackgroundLocationClient } from '../deviceLocation/BackgroundLocationClient';
import { useHasAlways } from '../deviceLocation/useHasAlways';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface AutomaticDetectionNoticeProps {
  readonly location: BackgroundLocationClient;
}

// On the session screen when « Always » is not granted: the parked spot is not detected, so the 30 min guard applies.
// Queued, so it does not cut off the offline announcement that can arrive with it.
export function AutomaticDetectionNotice({ location }: AutomaticDetectionNoticeProps) {
  const colors = useColors();
  const isOff = useHasAlways(location) === false;
  const message = i18n.t('session.detectionOff');
  useAnnouncement(isOff ? message : null, 0, { queued: true });
  if (!isOff) {
    return null;
  }
  return (
    <NoticeWithAction
      message={
        <StateMark color={colors.muted}>
          <Text style={[typography.body, { color: colors.ink }]}>{message}</Text>
        </StateMark>
      }
      action={{ label: i18n.t('session.openSettings'), onPress: () => void Linking.openSettings(), align: 'start' }}
    />
  );
}
