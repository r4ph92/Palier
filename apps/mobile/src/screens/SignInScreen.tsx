import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { IdentityProviderName } from '../auth/ProviderSignIn';
import { FieldError } from '../components/FieldError';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { ScreenHeader } from '../components/ScreenHeader';
import { i18n } from '../i18n/i18n';
import type { TestSignIn } from '../testSignIn/TestSignIn';
import { spacing } from '../theme/tokens';
import { useSingleFlight } from '../useSingleFlight';

interface SignInScreenProps {
  readonly testSignIn: TestSignIn | null;
  readonly onSignIn: (token: string) => Promise<void>;
  readonly onContinueWith: (provider: IdentityProviderName) => Promise<void>;
}

export function SignInScreen({ testSignIn, onSignIn, onContinueWith }: SignInScreenProps) {
  return (
    <ScreenFrame>
      <ScreenHeader eyebrow="Palier" title={i18n.t('signIn.title')} />
      <ProviderButtons onContinueWith={onContinueWith} />
      {testSignIn === null ? null : <testSignIn.Section client={testSignIn.client} onSignedIn={onSignIn} />}
    </ScreenFrame>
  );
}

// Apple comes first: App Store rule 4.8 requires it beside any other third-party sign-in.
function ProviderButtons({ onContinueWith }: { readonly onContinueWith: SignInScreenProps['onContinueWith'] }) {
  const { runningKey, failed, continueWith } = useContinueWith(onContinueWith);
  return (
    <View style={styles.providers}>
      {(['apple', 'google'] as const).map((provider) => (
        <PrimaryButton
          key={provider}
          label={i18n.t(`signIn.${provider}`)}
          busy={runningKey === provider}
          busyLabel={i18n.t('signIn.busy')}
          disabled={runningKey !== null}
          onPress={() => continueWith(provider)}
        />
      ))}
      {failed ? <FieldError message={i18n.t('signIn.failed')} /> : null}
    </View>
  );
}

// One provider at a time; any failure, from the sheet or from Palier, reads the same to the person.
function useContinueWith(onContinueWith: SignInScreenProps['onContinueWith']) {
  const { runningKey, run } = useSingleFlight<IdentityProviderName>();
  const [failed, setFailed] = useState(false);
  const continueWith = (provider: IdentityProviderName) =>
    run(provider, () => {
      setFailed(false);
      return onContinueWith(provider).catch(() => setFailed(true));
    });
  return { runningKey, failed, continueWith };
}

const styles = StyleSheet.create({
  providers: { gap: spacing.small, paddingBottom: spacing.large },
});
