import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { AuthClient } from './api/AuthClient';
import type { LotsClient } from './api/LotsClient';
import { LotsClientProvider } from './api/LotsClientContext';
import type { PaymentMethodClient } from './api/PaymentMethodClient';
import type { VehicleClient } from './api/VehicleClient';
import type { TokenStore } from './auth/TokenStore';
import { useSession, type SessionController, type SessionState } from './auth/useSession';
import { ErrorState } from './components/ErrorState';
import { TabBar, type Tab } from './components/TabBar';
import { usePaymentCard } from './payment/usePaymentCard';
import { AccountScreen } from './screens/AccountScreen';
import { AddVehicleScreen } from './screens/AddVehicleScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PaymentMethodScreen } from './screens/PaymentMethodScreen';
import { PrivacyNoticeScreen } from './screens/PrivacyNoticeScreen';
import { SignInScreen } from './screens/SignInScreen';
import { VehiclesScreen } from './screens/VehiclesScreen';
import { useColors } from './theme/useColors';
import { spacing } from './theme/tokens';

export interface PalierAppProps {
  readonly authClient: AuthClient;
  readonly tokenStore: TokenStore;
  readonly testSignInEnabled: boolean;
  readonly createLotsClient: (token: string, onUnauthorized: () => void) => LotsClient;
  readonly createPaymentMethodClient: (token: string, onUnauthorized: () => void) => PaymentMethodClient;
  readonly createVehicleClient: (token: string, onUnauthorized: () => void, onConsentRequired: () => void) => VehicleClient;
}

type AccountPage = 'account' | 'vehicles' | 'addVehicle' | 'payment';

export function PalierApp(props: PalierAppProps) {
  const session = useSession(props.authClient, props.tokenStore);
  const { state } = session;
  switch (state.status) {
    case 'restoring':
      return <PlainScreen />;
    case 'unreachable':
      return <StartupError onRetry={session.retry} />;
    case 'signedOut':
      return <SignInScreen testSignInEnabled={props.testSignInEnabled} authClient={props.authClient} onSignIn={session.signIn} />;
    case 'signedIn':
      return <SignedInApp signedIn={state} session={session} factories={props} />;
  }
}

interface SignedInAppProps {
  readonly signedIn: Extract<SessionState, { status: 'signedIn' }>;
  readonly session: SessionController;
  readonly factories: PalierAppProps;
}

function SignedInApp({ signedIn, session, factories }: SignedInAppProps) {
  const { driver } = signedIn;
  const clients = useSignedInClients(signedIn.token, session, factories);
  if (driver.acceptedNoticeVersion !== PRIVACY_NOTICE_VERSION) {
    return <PrivacyNoticeScreen onAccept={session.acceptNotice} onSignOut={session.signOut} />;
  }
  return <SignedInTabs firstName={driver.firstName} clients={clients} onSignOut={session.signOut} />;
}

interface SignedInClients {
  readonly lots: LotsClient;
  readonly payment: PaymentMethodClient;
  readonly vehicles: VehicleClient;
}

function useSignedInClients(token: string, session: SessionController, factories: PalierAppProps): SignedInClients {
  const { expire, refreshDriver } = session;
  const lots = useMemo(() => factories.createLotsClient(token, expire), [factories, token, expire]);
  const payment = useMemo(() => factories.createPaymentMethodClient(token, expire), [factories, token, expire]);
  const vehicles = useMemo(
    () => factories.createVehicleClient(token, expire, () => refreshDriver(token)),
    [factories, token, expire, refreshDriver],
  );
  return { lots, payment, vehicles };
}

interface SignedInTabsProps {
  readonly firstName: string;
  readonly clients: SignedInClients;
  readonly onSignOut: () => void;
}

function SignedInTabs({ firstName, clients, onSignOut }: SignedInTabsProps) {
  const { tab, accountPage, selectTab, setAccountPage } = useTabs();
  return (
    <View style={styles.app}>
      <LotsClientProvider client={clients.lots}>
        {tab === 'lots' ? (
          <HomeScreen firstName={firstName} />
        ) : (
          <AccountTab firstName={firstName} page={accountPage} clients={clients} onPageChange={setAccountPage} onSignOut={onSignOut} />
        )}
      </LotsClientProvider>
      <TabBar selected={tab} onSelect={selectTab} />
    </View>
  );
}

// Choosing a tab starts the account tab again at its first page, so Compte never reopens on Véhicules.
function useTabs() {
  const [tab, setTab] = useState<Tab>('lots');
  const [accountPage, setAccountPage] = useState<AccountPage>('account');
  function selectTab(next: Tab) {
    setTab(next);
    setAccountPage('account');
  }
  return { tab, accountPage, selectTab, setAccountPage };
}

interface AccountTabProps {
  readonly firstName: string;
  readonly page: AccountPage;
  readonly clients: SignedInClients;
  readonly onPageChange: (page: AccountPage) => void;
  readonly onSignOut: () => void;
}

function AccountTab({ firstName, page, clients, onPageChange, onSignOut }: AccountTabProps) {
  const { state: cardState, setCard } = usePaymentCard(clients.payment);
  switch (page) {
    case 'account':
      return <AccountScreen firstName={firstName} cardState={cardState} onOpenVehicles={() => onPageChange('vehicles')} onOpenPaymentMethod={() => onPageChange('payment')} onSignOut={onSignOut} />;
    case 'vehicles':
      return <VehiclesScreen firstName={firstName} client={clients.vehicles} onAddVehicle={() => onPageChange('addVehicle')} />;
    case 'addVehicle':
      return <AddVehicleScreen client={clients.vehicles} onCancel={() => onPageChange('vehicles')} onSaved={() => onPageChange('vehicles')} />;
    case 'payment':
      return <PaymentMethodScreen client={clients.payment} onSaved={setCard} onBack={() => onPageChange('account')} />;
  }
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
