import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatCardLabel } from '../payment/formatCardLabel';
import type { CardState } from '../payment/usePaymentCard';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface AccountScreenProps {
  readonly firstName: string;
  readonly cardState: CardState;
  readonly onOpenVehicles: () => void;
  readonly onOpenPaymentMethod: () => void;
  readonly onSignOut: () => void;
}

export function AccountScreen({ firstName, cardState, onOpenVehicles, onOpenPaymentMethod, onSignOut }: AccountScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.content}>
        <ScreenHeader eyebrow={firstName} title={i18n.t('account.title')} />
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>{describeCard(cardState)}</Text>
        <PrimaryButton label={i18n.t('account.vehicles')} onPress={onOpenVehicles} />
        <PrimaryButton label={i18n.t('account.paymentMethod')} onPress={onOpenPaymentMethod} />
        <PrimaryButton label={i18n.t('account.signOut')} onPress={onSignOut} />
      </View>
    </SafeAreaView>
  );
}

function describeCard(cardState: CardState): string {
  switch (cardState.status) {
    case 'loading':
      return i18n.t('account.cardLoading');
    case 'failed':
      return i18n.t('account.cardUnavailable');
    case 'loaded':
      return cardState.card === null ? i18n.t('account.cardNone') : formatCardLabel(cardState.card);
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing.medium, paddingHorizontal: spacing.medium },
});
