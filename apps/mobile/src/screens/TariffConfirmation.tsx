import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { StateMark } from '../components/StateMark';
import { TextButton } from '../components/TextButton';
import { useAccessibilityFocusOnMount } from '../components/useAccessibilityFocusOnMount';
import { useAnnouncement } from '../components/useAnnouncement';
import type { EntryState } from '../entries/useEntry';
import { i18n } from '../i18n/i18n';
import { holdSentence, tariffSentence } from '../i18n/tariffText';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

type QuotedState = Extract<EntryState, { status: 'quoted' | 'entering' }>;

interface TariffConfirmationProps {
  readonly state: QuotedState;
  readonly onEnter: () => void;
  readonly onCancel: () => void;
}

// #151: the price and the hold, shown before anything is held or opened; only « Entrer » asks for the barrier.
export function TariffConfirmation({ state, onEnter, onCancel }: TariffConfirmationProps) {
  const colors = useColors();
  const lotRef = useAccessibilityFocusOnMount();
  const { quote, tariffChanged } = state;
  const isEntering = state.status === 'entering';
  return (
    <View style={styles.section}>
      {tariffChanged ? <TariffChangedMark sentence={tariffSentence(quote.tariff)} /> : null}
      <View accessible ref={lotRef} style={styles.terms}>
        <Text style={[typography.lotName, { color: colors.ink }]}>{quote.lotName}</Text>
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>{tariffSentence(quote.tariff)}</Text>
        <Text style={[typography.body, { color: colors.ink }]}>{holdSentence(quote.holdCents)}</Text>
      </View>
      <PrimaryButton label={i18n.t('scan.enter')} busy={isEntering} busyLabel={i18n.t('scan.entering')} onPress={onEnter} />
      {isEntering ? null : <TextButton label={i18n.t('scan.cancel')} onPress={onCancel} />}
    </View>
  );
}

// Announced with the new tariff, since VoiceOver focus stays on the lot it already read.
function TariffChangedMark({ sentence }: { readonly sentence: string }) {
  const colors = useColors();
  const changed = i18n.t('scan.tariffChanged');
  useAnnouncement(`${changed}. ${sentence}`);
  return (
    <StateMark color={colors.low}>
      <Text accessibilityRole="alert" style={[typography.bodyStrong, { color: colors.ink }]}>
        {changed}
      </Text>
    </StateMark>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.medium },
  terms: { gap: spacing.small },
});
