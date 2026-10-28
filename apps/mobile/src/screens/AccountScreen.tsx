import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';

interface AccountScreenProps {
  readonly firstName: string;
  readonly onSignOut: () => void;
}

export function AccountScreen({ firstName, onSignOut }: AccountScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.content}>
        <ScreenHeader eyebrow={firstName} title={i18n.t('account.title')} />
        <PrimaryButton label={i18n.t('account.signOut')} onPress={onSignOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing.medium, paddingHorizontal: spacing.medium },
});
