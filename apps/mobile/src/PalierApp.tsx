import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { AuthClient } from './api/AuthClient';
import { alwaysOnline, type ConnectivitySource } from './api/ConnectivitySource';
import { onUpdateRequired, STORE_URL } from './api/appUpdate';
import type { CreateSignedInClients, SignedInClients } from './api/SignedInClients';
import type { TokenStore } from './auth/TokenStore';
import { useSession, type SessionController, type SessionState } from './auth/useSession';
import { ErrorState } from './components/ErrorState';
import { nullPositioningCore } from './positioning/nullPositioningCore';
import type { PositioningCore } from './positioning/PositioningCore';
import type { DeveloperEntry } from './screens/DeveloperEntry';
import type { DeviceTools } from './screens/DeviceTools';
import { AppUpdateRequiredScreen } from './screens/AppUpdateRequiredScreen';
import { PrivacyNoticeScreen } from './screens/PrivacyNoticeScreen';
import { SignedInTabs } from './screens/SignedInTabs';
import { SignInScreen } from './screens/SignInScreen';
import { useColors } from './theme/useColors';
import { spacing } from './theme/tokens';

export interface PalierAppProps {
  readonly authClient: AuthClient;
  readonly tokenStore: TokenStore;
  readonly testSignInEnabled: boolean;
  readonly createSignedInClients: CreateSignedInClients;
  readonly developerEntry?: DeveloperEntry | undefined;
  readonly positioning?: PositioningCore | undefined;
  readonly connectivity?: ConnectivitySource | undefined;
}

export function PalierApp(props: PalierAppProps) {
  const [updateRequired, setUpdateRequired] = useState(false);
  useEffect(() => onUpdateRequired(() => setUpdateRequired(true)), []);
  const session = useSession(props.authClient, props.tokenStore);
  const { state } = session;
  if (updateRequired) {
    return <AppUpdateRequiredScreen storeUrl={STORE_URL} />;
  }
  switch (state.status) {
    case 'restoring':
      return <PlainScreen />;
    case 'unreachable':
      return <StartupError onRetry={session.retry} />;
    case 'signedOut':
      return <SignInScreen testSignInEnabled={props.testSignInEnabled} authClient={props.authClient} onSignIn={session.signIn} />;
    case 'signedIn':
      return <SignedInApp signedIn={state} session={session} createClients={props.createSignedInClients} device={deviceOf(props)} />;
  }
}

interface SignedInAppProps {
  readonly signedIn: Extract<SessionState, { status: 'signedIn' }>;
  readonly session: SessionController;
  readonly createClients: CreateSignedInClients;
  readonly device: DeviceTools;
}

function deviceOf({ developerEntry, positioning, connectivity }: PalierAppProps): DeviceTools {
  return { developerEntry, positioning: positioning ?? nullPositioningCore, connectivity: connectivity ?? alwaysOnline };
}

function SignedInApp({ signedIn, session, createClients, device }: SignedInAppProps) {
  const { driver } = signedIn;
  const clients = useSignedInClients(signedIn.token, session, createClients);
  if (driver.acceptedNoticeVersion !== PRIVACY_NOTICE_VERSION) {
    return <PrivacyNoticeScreen onAccept={session.acceptNotice} onSignOut={session.signOut} />;
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
