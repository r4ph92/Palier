import type { ReceiptDetail } from '@palier/shared-types';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReceiptClient } from '../api/ReceiptClient';
import { ErrorState } from '../components/ErrorState';
import { MessageState } from '../components/MessageState';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { formatClockTime } from '../i18n/formatClockTime';
import { formatMoney } from '../i18n/formatMoney';
import { formatReceiptDate } from '../i18n/formatReceiptDate';
import { formatReceiptDuration } from '../i18n/formatReceiptDuration';
import { currentLanguage, i18n } from '../i18n/i18n';
import { LIST_SEPARATOR } from '../i18n/spaces';
import { useReceipt } from '../receipts/useReceipts';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface ReceiptScreenProps {
  readonly client: ReceiptClient;
  readonly sessionId: string;
  readonly onBack: () => void;
}

// One past receipt, with the figures behind its total.
export function ReceiptScreen({ client, sessionId, onBack }: ReceiptScreenProps) {
  const { state, reload } = useReceipt(client, sessionId);
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow={i18n.t('receipts.title')}
          title={state.status === 'loaded' ? state.value.lotName : i18n.t('receipts.title')}
          action={<TextButton label={i18n.t('receipts.back')} onPress={onBack} />}
        />
        {state.status === 'loading' ? <MessageState message={i18n.t('receipts.loading')} hint="" /> : null}
        {state.status === 'error' ? <ErrorState onRetry={reload} /> : null}
        {state.status === 'loaded' ? <ReceiptFigures receipt={state.value} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReceiptFigures({ receipt }: { readonly receipt: ReceiptDetail }) {
  const language = currentLanguage();
  const moment = (instant: string) => {
    const date = new Date(instant);
    return `${formatReceiptDate(date, language)}${LIST_SEPARATOR}${formatClockTime(date, language)}`;
  };
  return (
    <View style={styles.figures}>
      <Figure label={i18n.t('receipts.entry')} value={moment(receipt.enteredAt)} />
      <Figure label={i18n.t('receipts.exit')} value={moment(receipt.exitedAt)} />
      <Figure label={i18n.t('receipts.duration')} value={formatReceiptDuration(receipt.durationMinutes)} />
      <Figure label={i18n.t('receipts.pricePerIncrement')} value={formatMoney(receipt.incrementCents, language)} />
      <Figure label={i18n.t('receipts.increments')} value={receipt.capped ? `${receipt.increments}${LIST_SEPARATOR}${i18n.t('receipts.capped')}` : String(receipt.increments)} />
      <Figure label={i18n.t('receipts.total')} value={formatMoney(receipt.totalCents, language)} strong />
      {receipt.cardLast4 === null ? null : <Figure label={i18n.t('receipts.card')} value={i18n.t('receipts.cardEnding', { last4: receipt.cardLast4 })} />}
    </View>
  );
}

// The label sits above its value, so a long value never squeezes the label at large text sizes.
function Figure({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }) {
  const colors = useColors();
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={[styles.figure, { borderBottomColor: colors.line }]}>
      <Text style={[typography.eyebrow, { color: colors.muted }]}>{label}</Text>
      <Text style={[strong ? typography.figureStrong : typography.figure, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing.medium, paddingHorizontal: spacing.medium, paddingBottom: spacing.large },
  figures: { gap: spacing.small },
  figure: { gap: spacing.small, paddingVertical: spacing.small, borderBottomWidth: StyleSheet.hairlineWidth },
});
