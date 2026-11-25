import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { AuthClient } from './api/AuthClient';
import { onUpdateRequired, STORE_URL } from './api/appUpdate';
import type { CreateSignedInClients, SignedInClients } from './api/SignedInClients';
import { continueWithProvider } from './auth/continueWithProvider';
import type { IdentityProviderName, ProviderSignIn } from './auth/ProviderSignIn';
import type { TokenStore } from './auth/TokenStore';
import { useSession, type SessionController, type SessionState } from './auth/useSession';
import { ErrorState } from './components/ErrorState';
import { memoryQueueStorage, ParkedSignalQueue } from './parkingSessions/ParkedSignalQueue';
import { nullPositioningCore } from './positioning/nullPositioningCore';
import type { PositioningCore } from './positioning/PositioningCore';
import type { DeveloperEntry } from './screens/DeveloperEntry';
import type { DeviceTools } from './screens/DeviceTools';
import { AppUpdateRequiredScreen } from './screens/AppUpdateRequiredScreen';
import { NameScreen } from './screens/NameScreen';
import { PrivacyNoticeScreen } from './screens/PrivacyNoticeScreen';
import { SignedInTabs } from './screens/SignedInTabs';
import { SignInScreen } from './screens/SignInScreen';
import type { TestSignIn } from './testSignIn/TestSignIn';
import { useColors } from './theme/useColors';
import { spacing } from './theme/tokens';

export interface PalierAppProps {
  readonly authClient: AuthClient;
  readonly tokenStore: TokenStore;
  readonly providerSignIn: ProviderSignIn;
  readonly testSignIn: TestSignIn | null;
  readonly createSignedInClients: CreateSignedInClients;
  readonly developerEntry?: DeveloperEntry | undefined;
  readonly positioning?: PositioningCore | undefined;
  readonly parkedSignals?: ParkedSignalQueue | undefined;
}

export function PalierApp(props: PalierAppProps) {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [fallbackSignals] = useState(() => new ParkedSignalQueue(memoryQueueStorage()));
  useEffect(() => onUpdateRequired(() => setUpdateRequired(true)), []);
  const session = useSession(props.authClient, props.tokenStore);
  const { state } = session;
  const continueWith = useContinueWith(props, session);
  if (updateRequired) {
    return <AppUpdateRequiredScreen storeUrl={STORE_URL} />;
  }
  switch (state.status) {
    case 'restoring':
      return <PlainScreen />;
    case 'unreachable':
      return <StartupError onRetry={session.retry} />;
    case 'signedOut':
      return <SignInScreen testSignIn={props.testSignIn} onSignIn={session.signIn} onContinueWith={continueWith} />;
    case 'signedIn':
      return <SignedInApp signedIn={state} session={session} createClients={props.createSignedInClients} device={deviceOf(props, fallbackSignals)} />;
  }
}

function useContinueWith({ providerSignIn, authClient }: PalierAppProps, { signIn }: SessionController) {
  return useCallback(
    async (provider: IdentityProviderName) => {
      const token = await continueWithProvider(provider, providerSignIn, authClient);
      if (token !== null) {
        await signIn(token);
      }
    },
    [providerSignIn, authClient, signIn],
  );
}

interface SignedInAppProps {
  readonly signedIn: Extract<SessionState, { status: 'signedIn' }>;
  readonly session: SessionController;
  readonly createClients: CreateSignedInClients;
  readonly device: DeviceTools;
}

function deviceOf({ developerEntry, positioning, parkedSignals }: PalierAppProps, fallbackSignals: ParkedSignalQueue): DeviceTools {
  return { developerEntry, positioning: positioning ?? nullPositioningCore, parkedSignals: parkedSignals ?? fallbackSignals };
}

function SignedInApp({ signedIn, session, createClients, device }: SignedInAppProps) {
  const { driver } = signedIn;
  const clients = useSignedInClients(signedIn.token, session, createClients);
  if (driver.acceptedNoticeVersion !== PRIVACY_NOTICE_VERSION) {
    return <PrivacyNoticeScreen onAccept={session.acceptNotice} onSignOut={session.signOut} />;
  }
  // The notice comes first: the name is personal data, asked for only once the driver has accepted it.
  if (driver.firstName === '') {
    return <NameScreen onSave={session.saveName} />;
  }
  return <SignedInTabs firstName={driver.firstName} clients={clients} device={device} onSignOut={session.signOut} />;
}

function useSignedInClients(token: string, session: SessionController, createClients: CreateSignedInClients): SignedInClients {
  const { expire, refreshDriver } = session;
  return useMemo(
    () => createClients({ token, onUnauthorized: expire, onConsentRequired: () => refreshDriver(token) }),
    [createClients, token, expire, refreshDriver],
  );
}

function StartupError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <PlainScreen>
      <ErrorState onRetry={onRetry} />
    </PlainScreen>
  );
}

function PlainScreen({ children }: { readonly children?: ReactNode }) {
  const colors = useColors();
  return <SafeAreaView style={[styles.plain, { backgroundColor: colors.canvas }]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  plain: { flex: 1, paddingHorizontal: spacing.medium },
});
