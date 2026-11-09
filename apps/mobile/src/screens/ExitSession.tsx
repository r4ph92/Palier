import type { ExitReceipt } from '@palier/shared-types';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { FieldError } from '../components/FieldError';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { useAnnouncement } from '../components/useAnnouncement';
import { formatMoney } from '../i18n/formatMoney';
import { formatReceiptDuration } from '../i18n/formatReceiptDuration';
import { currentLanguage, i18n } from '../i18n/i18n';
import { NO_BREAK_SPACE } from '../i18n/spaces';
import { useExit } from '../parkingSessions/useExit';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface ExitButtonProps {
  readonly client: ParkingSessionClient;
  readonly sessionId: string;
  readonly onLeft: (receipt: ExitReceipt) => void;
  // Reads the session again: it was closed or is unknown to Palier.
  readonly onSessionMoved: () => void;
}

// « Ouvrir la barrière de sortie »: Palier takes the exact amount and opens the barrier; nothing is asked before, the tap is the exit.
export function ExitButton({ client, sessionId, onLeft, onSessionMoved }: ExitButtonProps) {
  const exiting = useExit(client, sessionId, { onLeft, onSessionMoved });
  // Under the button, which then stays where the driver pressed it.
  const message = exiting.isUnreachable ? i18n.t('session.exit.unreachable') : null;
  useAnnouncement(message, exiting.attempts);
  return (
    <View style={styles.group}>
      <PrimaryButton label={i18n.t('session.exit.action')} busyLabel={i18n.t('session.exit.opening')} busy={exiting.isSending} onPress={exiting.leave} />
      {message === null ? null : <FieldError message={message} />}
    </View>
  );
}

interface ExitReceiptScreenProps {
  readonly receipt: ExitReceipt;
  readonly onDone: () => void;
}

// The figures behind the amount, as Palier computed them: « Durée 3 h 15 · 13 × 0,75 $ · Total 9,75 $ ».
export function ExitReceiptScreen({ receipt, onDone }: ExitReceiptScreenProps) {
  const colors = useColors();
  const focusRef = useAccessibilityFocusOnMount();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow={i18n.t('session.exit.receipt.eyebrow')} title={i18n.t('session.exit.receipt.title')} />
        <View ref={focusRef} accessible>
          <ReceiptLine receipt={receipt} />
        </View>
        <PrimaryButton label={i18n.t('session.exit.receipt.done')} onPress={onDone} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ReceiptLine({ receipt }: { readonly receipt: ExitReceipt }) {
  const colors = useColors();
  const language = currentLanguage();
  const calculation = receipt.capped
    ? i18n.t('session.exit.receipt.capped')
    : `${receipt.increments}${NO_BREAK_SPACE}×${NO_BREAK_SPACE}${formatMoney(receipt.incrementCents, language)}`;
  return (
    <Text style={[typography.body, { color: colors.ink }]}>
      {i18n.t('session.exit.receipt.durationLead')}
      <Text style={typography.figure}>{formatReceiptDuration(receipt.durationMinutes)}</Text>
      {' · '}
      <Text style={receipt.capped ? typography.body : typography.figure}>{calculation}</Text>
      {' · '}
      {i18n.t('session.exit.receipt.totalLead')}
      <Text style={typography.figureStrong}>{formatMoney(receipt.totalCents, language)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.large, paddingHorizontal: spacing.medium, paddingBottom: spacing.large },
  group: { gap: spacing.medium },
});
