import { StyleSheet, Text, View } from 'react-native';
import { TextButton } from '../components/TextButton';
import { i18n } from '../i18n/i18n';
import type { CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

interface SessionNoticeProps {
  readonly state: CurrentParkingSessionState;
  readonly onRetry: () => void;
}

// Above the scan form: what Palier said about a current session, so a driver already inside is never left guessing.
export function SessionNotice({ state, onRetry }: SessionNoticeProps) {
  switch (state.status) {
    case 'none':
      return <MutedLine text={i18n.t('session.none')} />;
    case 'unknown':
      return (
        <View style={styles.withAction}>
          <MutedLine text={i18n.t('session.checkFailed')} />
          <TextButton label={i18n.t('scan.retry')} onPress={onRetry} />
        </View>
      );
    default:
      return null;
  }
}

function MutedLine({ text }: { readonly text: string }) {
  const colors = useColors();
  return <Text style={[typography.body, { color: colors.muted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  withAction: { alignItems: 'flex-start' },
});
