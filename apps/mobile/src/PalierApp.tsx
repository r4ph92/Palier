import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { AuthClient } from './api/AuthClient';
import type { LotsClient } from './api/LotsClient';
import { LotsClientProvider } from './api/LotsClientContext';
import type { VehicleClient } from './api/VehicleClient';
import type { TokenStore } from './auth/TokenStore';
import { useSession, type SessionController, type SessionState } from './auth/useSession';
import { ErrorState } from './components/ErrorState';
import { TabBar, type Tab } from './components/TabBar';
import { AccountScreen } from './screens/AccountScreen';
import { AddVehicleScreen } from './screens/AddVehicleScreen';
import { HomeScreen } from './screens/HomeScreen';
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
  readonly createVehicleClient: (token: string, onUnauthorized: () => void, onConsentRequired: () => void) => VehicleClient;
}

type AccountPage = 'account' | 'vehicles' | 'addVehicle';

export function PalierApp({ authClient, tokenStore, testSignInEnabled, createLotsClient, createVehicleClient }: PalierAppProps) {
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
      return <SignedInApp signedIn={state} session={session} createLotsClient={createLotsClient} createVehicleClient={createVehicleClient} />;
  }
}

interface SignedInAppProps {
  readonly signedIn: Extract<SessionState, { status: 'signedIn' }>;
  readonly session: SessionController;
  readonly createLotsClient: PalierAppProps['createLotsClient'];
  readonly createVehicleClient: PalierAppProps['createVehicleClient'];
}

function SignedInApp({ signedIn, session, createLotsClient, createVehicleClient }: SignedInAppProps) {
  const { token, driver } = signedIn;
  const { expire, signOut, acceptNotice, refreshDriver } = session;
  const lotsClient = useMemo(() => createLotsClient(token, expire), [createLotsClient, token, expire]);
  const vehicleClient = useMemo(
    () => createVehicleClient(token, expire, () => refreshDriver(token)),
    [createVehicleClient, token, expire, refreshDriver],
  );
  if (driver.acceptedNoticeVersion !== PRIVACY_NOTICE_VERSION) {
    return <PrivacyNoticeScreen onAccept={acceptNotice} onSignOut={signOut} />;
  }
  return (
    <SignedInTabs firstName={driver.firstName} lotsClient={lotsClient} vehicleClient={vehicleClient} onSignOut={signOut} />
  );
}

interface SignedInTabsProps {
  readonly firstName: string;
  readonly lotsClient: LotsClient;
  readonly vehicleClient: VehicleClient;
  readonly onSignOut: () => void;
}

function SignedInTabs({ firstName, lotsClient, vehicleClient, onSignOut }: SignedInTabsProps) {
  const [tab, setTab] = useState<Tab>('lots');
  const [accountPage, setAccountPage] = useState<AccountPage>('account');
  // Choosing a tab starts the account tab again at its first page, so Compte never reopens on Véhicules.
  function selectTab(next: Tab) {
    setTab(next);
    setAccountPage('account');
  }
  return (
    <View style={styles.app}>
      <LotsClientProvider client={lotsClient}>
        {tab === 'lots' ? (
          <HomeScreen firstName={firstName} />
        ) : (
          <AccountTab firstName={firstName} page={accountPage} client={vehicleClient} onPageChange={setAccountPage} onSignOut={onSignOut} />
        )}
      </LotsClientProvider>
      <TabBar selected={tab} onSelect={selectTab} />
    </View>
  );
}

interface AccountTabProps {
  readonly firstName: string;
  readonly page: AccountPage;
  readonly client: VehicleClient;
  readonly onPageChange: (page: AccountPage) => void;
  readonly onSignOut: () => void;
}

function AccountTab({ firstName, page, client, onPageChange, onSignOut }: AccountTabProps) {
  switch (page) {
    case 'account':
      return <AccountScreen firstName={firstName} onOpenVehicles={() => onPageChange('vehicles')} onSignOut={onSignOut} />;
    case 'vehicles':
      return <VehiclesScreen firstName={firstName} client={client} onAddVehicle={() => onPageChange('addVehicle')} />;
    case 'addVehicle':
      return <AddVehicleScreen client={client} onCancel={() => onPageChange('vehicles')} onSaved={() => onPageChange('vehicles')} />;
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
