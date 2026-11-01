import { Linking, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface AppUpdateRequiredScreenProps {
  readonly storeUrl: string | undefined;
}

// Shown in place of the app when the API no longer accepts this version; the message is the only focus target.
export function AppUpdateRequiredScreen({ storeUrl }: AppUpdateRequiredScreenProps) {
  const colors = useColors();
  return (
    <ScreenFrame>
      <View style={styles.message}>
        <Text accessibilityRole="alert" style={[typography.title, { color: colors.ink }]}>
          {i18n.t('update.title')}
        </Text>
        <Text style={[typography.body, { color: colors.ink }]}>{i18n.t('update.message')}</Text>
      </View>
      {storeUrl === undefined ? null : (
        <PrimaryButton label={i18n.t('update.action')} onPress={() => void Linking.openURL(storeUrl)} />
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  message: { gap: spacing.medium, paddingTop: spacing.large },
});
