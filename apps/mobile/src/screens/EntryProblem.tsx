import { StyleSheet, Text, View } from 'react-native';
import { StateMark } from '../components/StateMark';
import { TextButton } from '../components/TextButton';
import { useAnnouncement } from '../components/useAnnouncement';
import type { EntryRefusal, EntryState } from '../entries/useEntry';
import { formatMoney } from '../i18n/formatMoney';
import { currentLanguage, i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface EntryProblemProps {
  readonly state: EntryState;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

export function EntryProblem({ state, onAddPlate, onAddCard }: EntryProblemProps) {
  const message = problemMessage(state);
  useAnnouncement(message);
  if (message === null) {
    return null;
  }
  return (
    <View style={styles.field}>
      <ProblemMessage message={message} hint={state.status === 'unreachable' ? i18n.t('scan.unreachableHint') : null} />
      {state.status === 'refused' ? <RefusalActions refusal={state.refusal} onAddPlate={onAddPlate} onAddCard={onAddCard} /> : null}
    </View>
  );
}

interface RefusalActionsProps {
  readonly refusal: EntryRefusal;
  readonly onAddPlate: () => void;
  readonly onAddCard: () => void;
}

// The refusals the driver fixes in the account get a button straight to the page to fix.
function RefusalActions({ refusal, onAddPlate, onAddCard }: RefusalActionsProps) {
  if (refusal === 'PREREQUISITES_MISSING') {
    return (
      <View style={styles.links}>
        <TextButton label={i18n.t('scan.addPlate')} onPress={onAddPlate} />
        <TextButton label={i18n.t('scan.addCard')} onPress={onAddCard} />
      </View>
    );
  }
  if (refusal === 'CARD_DECLINED') {
    return (
      <View style={styles.links}>
        <TextButton label={i18n.t('scan.paymentMethod')} onPress={onAddCard} />
      </View>
    );
  }
  return null;
}

function ProblemMessage({ message, hint }: { readonly message: string; readonly hint: string | null }) {
  const colors = useColors();
  return (
    <>
      <StateMark color={colors.danger}>
        <Text accessibilityRole="alert" style={[typography.bodyStrong, { color: colors.ink }]}>
          {message}
        </Text>
      </StateMark>
      {hint === null ? null : <Text style={[typography.body, { color: colors.muted }]}>{hint}</Text>}
    </>
  );
}

function problemMessage(state: EntryState): string | null {
  switch (state.status) {
    case 'refused':
      return refusalMessage(state.refusal, state.authorizedCents);
    case 'notResponding':
      return i18n.t('scan.notResponding');
    case 'unreachable':
      return i18n.t('scan.unreachable');
    default:
      return null;
  }
}

// A declined card names the refused hold; without the amount it falls back to the short refusal.
function refusalMessage(refusal: EntryRefusal, authorizedCents: number | null): string {
  if (refusal === 'CARD_DECLINED' && authorizedCents !== null) {
    return i18n.t('scan.cardDeclined', { amount: formatMoney(authorizedCents, currentLanguage()) });
  }
  return i18n.t(`scan.refusals.${refusal}`);
}

const styles = StyleSheet.create({
  field: { gap: spacing.small },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.large },
});
