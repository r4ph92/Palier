import { ScreenFrame } from '../components/ScreenFrame';
import { ScreenHeader } from '../components/ScreenHeader';
import { i18n } from '../i18n/i18n';
import type { TestSignIn } from '../testSignIn/TestSignIn';

interface SignInScreenProps {
  readonly testSignIn: TestSignIn | null;
  readonly onSignIn: (token: string) => Promise<void>;
}

export function SignInScreen({ testSignIn, onSignIn }: SignInScreenProps) {
  return (
    <ScreenFrame>
      <ScreenHeader eyebrow="Palier" title={i18n.t('signIn.title')} />
      {testSignIn === null ? null : <testSignIn.Section client={testSignIn.client} onSignedIn={onSignIn} />}
    </ScreenFrame>
  );
}
