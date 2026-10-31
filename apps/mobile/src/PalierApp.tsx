import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { AuthClient } from './api/AuthClient';
import type { LotsClient } from './api/LotsClient';
import { LotsClientProvider } from './api/LotsClientContext';
import type { PaymentMethodClient } from './api/PaymentMethodClient';
import type { TokenStore } from './auth/TokenStore';
import { useSession, type SessionController, type SessionState } from './auth/useSession';
import { ErrorState } from './components/ErrorState';
import { TabBar, type Tab } from './components/TabBar';
import { usePaymentCard } from './payment/usePaymentCard';
import { AccountScreen } from './screens/AccountScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PaymentMethodScreen } from './screens/PaymentMethodScreen';
import { PrivacyNoticeScreen } from './screens/PrivacyNoticeScreen';
import { SignInScreen } from './screens/SignInScreen';
import { useColors } from './theme/useColors';
import { spacing } from './theme/tokens';

export interface PalierAppProps {
  readonly authClient: AuthClient;
  readonly tokenStore: TokenStore;
  readonly testSignInEnabled: boolean;
  readonly createLotsClient: (token: string, onUnauthorized: () => void) => LotsClient;
  readonly createPaymentMethodClient: (token: string, onUnauthorized: () => void) => PaymentMethodClient;
}

export function PalierApp({ authClient, tokenStore, testSignInEnabled, createLotsClient, createPaymentMethodClient }: PalierAppProps) {
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
      return <SignedInApp signedIn={state} session={session} createLotsClient={createLotsClient} createPaymentMethodClient={createPaymentMethodClient} />;
  }
}

interface SignedInAppProps {
  readonly signedIn: Extract<SessionState, { status: 'signedIn' }>;
  readonly session: SessionController;
  readonly createLotsClient: PalierAppProps['createLotsClient'];
  readonly createPaymentMethodClient: PalierAppProps['createPaymentMethodClient'];
}

function SignedInApp({ signedIn, session, createLotsClient, createPaymentMethodClient }: SignedInAppProps) {
  const { token, driver } = signedIn;
  const { expire, signOut, acceptNotice } = session;
  const lotsClient = useMemo(() => createLotsClient(token, expire), [createLotsClient, token, expire]);
  const paymentClient = useMemo(() => createPaymentMethodClient(token, expire), [createPaymentMethodClient, token, expire]);
  if (driver.acceptedNoticeVersion !== PRIVACY_NOTICE_VERSION) {
    return <PrivacyNoticeScreen onAccept={acceptNotice} onSignOut={signOut} />;
  }
  return <SignedInTabs firstName={driver.firstName} lotsClient={lotsClient} paymentClient={paymentClient} onSignOut={signOut} />;
}

interface SignedInTabsProps {
  readonly firstName: string;
  readonly lotsClient: LotsClient;
  readonly paymentClient: PaymentMethodClient;
  readonly onSignOut: () => void;
}

function SignedInTabs({ firstName, lotsClient, paymentClient, onSignOut }: SignedInTabsProps) {
  const [tab, setTab] = useState<Tab>('lots');
  return (
    <View style={styles.app}>
      <LotsClientProvider client={lotsClient}>
        {tab === 'lots' ? <HomeScreen firstName={firstName} /> : <AccountTab firstName={firstName} paymentClient={paymentClient} onSignOut={onSignOut} />}
      </LotsClientProvider>
      <TabBar selected={tab} onSelect={setTab} />
    </View>
  );
}

interface AccountTabProps {
  readonly firstName: string;
  readonly paymentClient: PaymentMethodClient;
  readonly onSignOut: () => void;
}

// Leaving the tab closes the payment method screen and reloads the card the next time Compte opens.
function AccountTab({ firstName, paymentClient, onSignOut }: AccountTabProps) {
  const { state, setCard } = usePaymentCard(paymentClient);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  if (isPaymentOpen) {
    return <PaymentMethodScreen client={paymentClient} onSaved={setCard} onBack={() => setIsPaymentOpen(false)} />;
  }
  return <AccountScreen firstName={firstName} cardState={state} onOpenPaymentMethod={() => setIsPaymentOpen(true)} onSignOut={onSignOut} />;
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
