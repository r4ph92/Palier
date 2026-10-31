import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardField } from '@stripe/stripe-react-native';
import type { SavedCard } from '@palier/shared-types';
import type { PaymentMethodClient } from '../api/PaymentMethodClient';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { i18n } from '../i18n/i18n';
import { useCardSave } from '../payment/useCardSave';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface PaymentMethodScreenProps {
  readonly client: PaymentMethodClient;
  readonly onSaved: (card: SavedCard) => void;
  readonly onBack: () => void;
}

export function PaymentMethodScreen({ client, onSaved, onBack }: PaymentMethodScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      {/* A ScrollView keeps the card field and the save button reachable at the largest text sizes. */}
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow={i18n.t('account.title')} title={i18n.t('payment.title')} action={<TextButton label={i18n.t('payment.back')} onPress={onBack} />} />
        <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('payment.intro')}</Text>
        <CardSaveForm client={client} onSaved={onSaved} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CardSaveForm({ client, onSaved }: Pick<PaymentMethodScreenProps, 'client' | 'onSaved'>) {
  const colors = useColors();
  const { status, save, setIsComplete } = useCardSave(client, onSaved);
  return (
    <>
      <CardField
        postalCodeEnabled={false}
        accessibilityLabel={i18n.t('payment.cardField')}
        cardStyle={{ backgroundColor: colors.canvas, textColor: colors.ink }}
        style={styles.cardField}
        onCardChange={(details) => setIsComplete(details.complete)}
      />
      <PrimaryButton label={status === 'saving' ? i18n.t('payment.saving') : i18n.t('payment.save')} onPress={save} />
      {status === 'idle' || status === 'saving' ? null : (
        <Text style={[typography.bodyStrong, { color: colors.ink }]}>{i18n.t(`payment.${status}`)}</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium },
  cardField: { width: '100%', height: 50 },
});
