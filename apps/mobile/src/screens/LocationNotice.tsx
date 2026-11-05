import { StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { useAnnouncement } from '../components/useAnnouncement';
import type { DriverLocation } from '../deviceLocation/locateDriver';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface LocationNoticeProps {
  readonly location: DriverLocation;
}

// Above the list when it falls back to name order; announced once, since the message stays the same across refreshes.
export function LocationNotice({ location }: LocationNoticeProps) {
  const colors = useColors();
  const message = noticeFor(location);
  useAnnouncement(message);
  if (message === null) {
    return null;
  }
  return (
    <View style={styles.notice}>
      <StateMark color={colors.muted}>
        <Text style={[typography.body, { color: colors.ink }]}>{message}</Text>
      </StateMark>
    </View>
  );
}

function noticeFor(location: DriverLocation): string | null {
  switch (location.status) {
    case 'located':
      return null;
    case 'denied':
      return i18n.t('home.locationDenied');
    case 'unavailable':
      return i18n.t('home.locationUnavailable');
  }
}

const styles = StyleSheet.create({
  notice: { paddingTop: spacing.medium },
});
