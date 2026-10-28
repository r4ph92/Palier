import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PalierUnreachableError } from '../api/LotsClient';
import { ErrorState } from '../components/ErrorState';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextButton } from '../components/TextButton';
import { i18n } from '../i18n/i18n';
import { useColors } from '../theme/useColors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

interface PrivacyNoticeScreenProps {
  readonly onAccept: () => Promise<void>;
  readonly onSignOut: () => void;
}

type NoticeState = { readonly status: 'reading' } | { readonly status: 'refused' } | { readonly status: 'failed' };

export function PrivacyNoticeScreen({ onAccept, onSignOut }: PrivacyNoticeScreenProps) {
  const colors = useColors();
  const { state, refuse, accept } = useNoticeDecision(onAccept);
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: colors.canvas }]}>
      {state.status === 'refused' ? <RefusedNotice onSignOut={onSignOut} /> : null}
      {state.status === 'failed' ? (
        <View style={styles.content}>
          <ErrorState onRetry={accept} />
        </View>
      ) : null}
      {state.status === 'reading' ? <ReadingNotice onAccept={accept} onRefuse={refuse} /> : null}
    </SafeAreaView>
  );
}

function ReadingNotice({ onAccept, onRefuse }: { readonly onAccept: () => void; readonly onRefuse: () => void }) {
  const colors = useColors();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="Palier" title={i18n.t('notice.title')} />
      <Text style={[typography.body, { color: colors.ink }]}>{i18n.t('notice.intro')}</Text>
      <View style={styles.list}>
        {(['plates', 'times', 'spot', 'payment'] as const).map((item) => (
          <Text key={item} style={[typography.body, { color: colors.ink }]}>
            {`• ${i18n.t(`notice.${item}`)}`}
          </Text>
        ))}
      </View>
      <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('notice.why')}</Text>
      <Text style={[typography.body, { color: colors.muted }]}>{i18n.t('notice.retention')}</Text>
      <PrimaryButton label={i18n.t('notice.accept')} onPress={onAccept} />
      <TextButton label={i18n.t('notice.refuse')} onPress={onRefuse} />
    </ScrollView>
  );
}

function RefusedNotice({ onSignOut }: { readonly onSignOut: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.content}>
      <ScreenHeader eyebrow="Palier" title={i18n.t('notice.title')} />
      <Text style={[typography.body, { color: colors.ink }]}>{i18n.t('notice.refused')}</Text>
      <PrimaryButton label={i18n.t('account.signOut')} onPress={onSignOut} />
    </View>
  );
}

function useNoticeDecision(onAccept: () => Promise<void>) {
  const [state, setState] = useState<NoticeState>({ status: 'reading' });
  // An error rejected in an async callback bypasses error boundaries; throwing from a state updater re-raises it during render.
  const settleFailure = useCallback((error: unknown) => {
    setState(() => {
      if (error instanceof PalierUnreachableError) {
        return { status: 'failed' };
      }
      throw error;
    });
  }, []);
  const accept = useCallback(() => {
    onAccept().catch(settleFailure);
  }, [onAccept, settleFailure]);
  const refuse = useCallback(() => setState({ status: 'refused' }), []);
  return { state, refuse, accept };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.medium, paddingHorizontal: spacing.medium },
  list: { gap: spacing.small },
});
