import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PalierUnreachableError } from '../api/LotsClient';
import { ErrorState } from '../components/ErrorState';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
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
  const { state, refuse, accept } = useNoticeDecision(onAccept);
  const { scrollRef, scrollToErrorWhenLaidOut } = useScrollToErrorWhenLaidOut(state.status === 'failed');
  return (
    <ScreenFrame scrollRef={scrollRef} onContentSizeChange={scrollToErrorWhenLaidOut}>
      {state.status === 'refused' ? (
        <RefusedNotice onSignOut={onSignOut} />
      ) : (
        <ReadingNotice failed={state.status === 'failed'} onAccept={accept} onRefuse={refuse} />
      )}
    </ScreenFrame>
  );
}

function ReadingNotice({
  failed,
  onAccept,
  onRefuse,
}: {
  readonly failed: boolean;
  readonly onAccept: () => void;
  readonly onRefuse: () => void;
}) {
  return (
    <>
      <ScreenHeader eyebrow="Palier" title={i18n.t('notice.title')} />
      <NoticeText />
      <PrimaryButton label={i18n.t('notice.accept')} onPress={onAccept} />
      <TextButton label={i18n.t('notice.refuse')} onPress={onRefuse} />
      {failed ? <ErrorState onRetry={onAccept} /> : null}
    </>
  );
}

function NoticeText() {
  const colors = useColors();
  return (
    <>
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
    </>
  );
}

// The message is the only thing VoiceOver focuses here, so the title is left out of this state.
function RefusedNotice({ onSignOut }: { readonly onSignOut: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.refused}>
      <Text accessibilityRole="alert" style={[typography.body, { color: colors.ink }]}>
        {i18n.t('notice.refused')}
      </Text>
      <PrimaryButton label={i18n.t('account.signOut')} onPress={onSignOut} />
    </View>
  );
}

// The error sits below the buttons, so the notice scrolls down to it once that layout exists, not before.
function useScrollToErrorWhenLaidOut(failed: boolean) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const pending = useRef(false);
  useEffect(() => {
    pending.current = failed;
  }, [failed]);
  const scrollToErrorWhenLaidOut = () => {
    if (pending.current) {
      pending.current = false;
      scrollRef.current?.scrollToEnd();
    }
  };
  return { scrollRef, scrollToErrorWhenLaidOut };
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
  list: { gap: spacing.small },
  refused: { gap: spacing.small, paddingTop: spacing.small },
});
