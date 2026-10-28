import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthClient } from './api/AuthClient';
import type { LotsClient } from './api/LotsClient';
import { LotsClientProvider } from './api/LotsClientContext';
import type { TokenStore } from './auth/TokenStore';
import { useSession, type SessionController, type SessionState } from './auth/useSession';
import { ErrorState } from './components/ErrorState';
import { TabBar, type Tab } from './components/TabBar';
import { AccountScreen } from './screens/AccountScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SignInScreen } from './screens/SignInScreen';
import { useColors } from './theme/useColors';
import { spacing } from './theme/tokens';

export interface PalierAppProps {
  readonly authClient: AuthClient;
  readonly tokenStore: TokenStore;
  readonly testSignInEnabled: boolean;
  readonly createLotsClient: (token: string, onUnauthorized: () => void) => LotsClient;
}

export function PalierApp({ authClient, tokenStore, testSignInEnabled, createLotsClient }: PalierAppProps) {
  const session = useSession(authClient, tokenStore);
  const { state } = session;
  switch (state.status) {
    case 'restoring':
      return <PlainScreen />;
    case 'unreachable':
      return <StartupError onRetry={session.retry} />;
    case 'signedOut':
      return <SignInScreen testSignInEnabled={testSignInEnabled} authClient={authClient} onSignIn={session.signIn} />;
    case 'signedIn':
      return <SignedInApp signedIn={state} session={session} createLotsClient={createLotsClient} />;
  }
}

interface SignedInAppProps {
  readonly signedIn: Extract<SessionState, { status: 'signedIn' }>;
  readonly session: SessionController;
  readonly createLotsClient: PalierAppProps['createLotsClient'];
}

function SignedInApp({ signedIn, session, createLotsClient }: SignedInAppProps) {
  const [tab, setTab] = useState<Tab>('lots');
  const { token, driver } = signedIn;
  const { expire, signOut } = session;
  const lotsClient = useMemo(() => createLotsClient(token, expire), [createLotsClient, token, expire]);
  return (
    <View style={styles.app}>
      <LotsClientProvider client={lotsClient}>
        {tab === 'lots' ? <HomeScreen firstName={driver.firstName} /> : <AccountScreen firstName={driver.firstName} onSignOut={signOut} />}
      </LotsClientProvider>
      <TabBar selected={tab} onSelect={setTab} />
    </View>
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
  app: { flex: 1 },
  plain: { flex: 1, paddingHorizontal: spacing.medium },
});
