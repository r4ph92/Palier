import { Linking, StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { TextButton } from '../components/TextButton';
import { useAnnouncement } from '../components/useAnnouncement';
import type { BackgroundLocationClient } from '../deviceLocation/BackgroundLocationClient';
import { useBackgroundLocationStatus } from '../deviceLocation/useBackgroundLocationStatus';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface AutomaticDetectionNoticeProps {
  readonly location: BackgroundLocationClient;
}

// On the session screen when « Always » is not granted: the parked spot is not detected, so the 30 min guard applies.
export function AutomaticDetectionNotice({ location }: AutomaticDetectionNoticeProps) {
  const colors = useColors();
  const status = useBackgroundLocationStatus(location);
  const isOff = status === 'limited' || status === 'denied';
  const message = i18n.t('session.detectionOff');
  useAnnouncement(isOff ? message : null);
  if (!isOff) {
    return null;
  }
  return (
    <View style={styles.withAction}>
      <StateMark color={colors.muted}>
        <Text style={[typography.body, { color: colors.ink }]}>{message}</Text>
      </StateMark>
      <TextButton label={i18n.t('session.openSettings')} onPress={() => void Linking.openSettings()} align="start" />
    </View>
  );
}

const styles = StyleSheet.create({
  withAction: { alignItems: 'flex-start' },
});
