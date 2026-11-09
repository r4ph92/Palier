import type { ReceiptSummary } from '@palier/shared-types';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useReceiptList, type ReceiptsController } from '../receipts/useReceipts';
import { useColors } from '../theme/useColors';
import { MINIMUM_TOUCH_TARGET, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const NO_RECEIPTS: readonly ReceiptSummary[] = [];

interface ReceiptsScreenProps {
  readonly client: ReceiptClient;
  readonly onOpenReceipt: (sessionId: string) => void;
  readonly onBack: () => void;
}

// The driver's closed sessions, newest first, as Palier lists them: « Compte » > « Reçus ».
export function ReceiptsScreen({ client, onOpenReceipt, onBack }: ReceiptsScreenProps) {
  const controller = useReceiptList(client);
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <FlatList
        data={controller.state.status === 'loaded' ? controller.state.value : NO_RECEIPTS}
        keyExtractor={(receipt) => receipt.sessionId}
        renderItem={({ item }) => <ReceiptRow receipt={item} onOpen={() => onOpenReceipt(item.sessionId)} />}
        ListHeaderComponent={
          <ScreenHeader eyebrow={i18n.t('account.title')} title={i18n.t('receipts.title')} action={<TextButton label={i18n.t('receipts.back')} onPress={onBack} />} />
        }
        ListEmptyComponent={<ReceiptsStateMessage controller={controller} />}
        contentContainerStyle={styles.content}
        testID="receipt-list"
      />
    </SafeAreaView>
  );
}

function ReceiptsStateMessage({ controller }: { readonly controller: ReceiptsController<readonly ReceiptSummary[]> }) {
  switch (controller.state.status) {
    case 'loading':
      return <MessageState message={i18n.t('receipts.loading')} hint="" />;
    case 'error':
      return <ErrorState onRetry={controller.reload} />;
    case 'loaded':
      return <MessageState message={i18n.t('receipts.empty')} hint={i18n.t('receipts.emptyHint')} />;
  }
}

interface ReceiptLine {
  readonly when: string;
  readonly duration: string;
  readonly total: string;
}

function receiptLine(receipt: ReceiptSummary): ReceiptLine {
  const language = currentLanguage();
  const exitedAt = new Date(receipt.exitedAt);
  return {
    when: `${formatReceiptDate(exitedAt, language)}${LIST_SEPARATOR}${formatClockTime(exitedAt, language)}`,
    duration: formatReceiptDuration(receipt.durationMinutes),
    total: formatMoney(receipt.totalCents, language),
  };
}

function ReceiptRow({ receipt, onOpen }: { readonly receipt: ReceiptSummary; readonly onOpen: () => void }) {
  const colors = useColors();
  const { when, duration, total } = receiptLine(receipt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${receipt.lotName}, ${when}, ${i18n.t('receipts.duration')} ${duration}, ${i18n.t('receipts.total')} ${total}`}
      onPress={onOpen}
      testID={`receipt-row-${receipt.sessionId}`}
      style={[styles.row, { borderBottomColor: colors.line }]}
    >
      <Text style={[typography.bodyStrong, { color: colors.ink }]}>{receipt.lotName}</Text>
      <Text style={[typography.body, { color: colors.muted }]}>{when}</Text>
      <View style={styles.figures}>
        <Text style={[typography.figure, { color: colors.ink }]}>{duration}</Text>
        <Text style={[typography.figureStrong, { color: colors.ink }]}>{total}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.medium, paddingBottom: spacing.large },
  row: { minHeight: MINIMUM_TOUCH_TARGET, gap: spacing.small, paddingVertical: spacing.medium, borderBottomWidth: StyleSheet.hairlineWidth },
  // Wraps under the date at large text sizes instead of cutting the total off.
  figures: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.small },
});
