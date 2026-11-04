import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_NOTICE_VERSION } from '@palier/shared-types/privacy';
import type { AuthClient } from './api/AuthClient';
import { onUpdateRequired, STORE_URL } from './api/appUpdate';
import { LotsClientProvider } from './api/LotsClientContext';
import type { CreateSignedInClients, SignedInClients } from './api/SignedInClients';
import type { TokenStore } from './auth/TokenStore';
import { useSession, type SessionController, type SessionState } from './auth/useSession';
import { ErrorState } from './components/ErrorState';
import { TabBar, type Tab } from './components/TabBar';
import { AccountTab, type AccountPage } from './screens/AccountTab';
import type { DeveloperEntry } from './screens/DeveloperEntry';
import { AppUpdateRequiredScreen } from './screens/AppUpdateRequiredScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PrivacyNoticeScreen } from './screens/PrivacyNoticeScreen';
import { ScanScreen } from './screens/ScanScreen';
import { SignInScreen } from './screens/SignInScreen';
import { useColors } from './theme/useColors';
import { spacing } from './theme/tokens';

export interface PalierAppProps {
  readonly authClient: AuthClient;
  readonly tokenStore: TokenStore;
  readonly testSignInEnabled: boolean;
  readonly createSignedInClients: CreateSignedInClients;
  readonly developerEntry?: DeveloperEntry | undefined;
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
      return <SignedInApp signedIn={state} session={session} createClients={props.createSignedInClients} developerEntry={props.developerEntry} />;
  }
}

interface SignedInAppProps {
  readonly signedIn: Extract<SessionState, { status: 'signedIn' }>;
  readonly session: SessionController;
  readonly createClients: CreateSignedInClients;
  readonly developerEntry: DeveloperEntry | undefined;
}

function SignedInApp({ signedIn, session, createClients, developerEntry }: SignedInAppProps) {
  const { driver } = signedIn;
  const clients = useSignedInClients(signedIn.token, session, createClients);
  if (driver.acceptedNoticeVersion !== PRIVACY_NOTICE_VERSION) {
    return <PrivacyNoticeScreen onAccept={session.acceptNotice} onSignOut={session.signOut} />;
  }
  return <SignedInTabs firstName={driver.firstName} clients={clients} developerEntry={developerEntry} onSignOut={session.signOut} />;
}

function useSignedInClients(token: string, session: SessionController, createClients: CreateSignedInClients): SignedInClients {
  const { expire, refreshDriver } = session;
  return useMemo(
    () => createClients({ token, onUnauthorized: expire, onConsentRequired: () => refreshDriver(token) }),
    [createClients, token, expire, refreshDriver],
  );
}

interface SignedInTabsProps {
  readonly firstName: string;
  readonly clients: SignedInClients;
  readonly developerEntry: DeveloperEntry | undefined;
  readonly onSignOut: () => void;
}

function SignedInTabs({ firstName, clients, developerEntry, onSignOut }: SignedInTabsProps) {
  const tabs = useTabs();
  return (
    <View style={styles.app}>
      <LotsClientProvider client={clients.lots}>
        <TabContent firstName={firstName} clients={clients} tabs={tabs} developerEntry={developerEntry} onSignOut={onSignOut} />
      </LotsClientProvider>
      <TabBar selected={tabs.tab} onSelect={tabs.selectTab} />
    </View>
  );
}

interface TabContentProps extends SignedInTabsProps {
  readonly tabs: TabsController;
}

function TabContent({ firstName, clients, tabs, developerEntry, onSignOut }: TabContentProps) {
  switch (tabs.tab) {
    case 'lots':
      return <HomeScreen firstName={firstName} />;
    case 'scan':
      return <ScanScreen client={clients.entry} onAddPlate={() => tabs.openAccountPage('vehicles')} onAddCard={() => tabs.openAccountPage('payment')} />;
    case 'account':
      return <AccountTab firstName={firstName} page={tabs.accountPage} clients={clients} developerEntry={developerEntry} onPageChange={tabs.setAccountPage} onSignOut={onSignOut} />;
  }
}

interface TabsController {
  readonly tab: Tab;
  readonly accountPage: AccountPage;
  selectTab(next: Tab): void;
  setAccountPage(page: AccountPage): void;
  openAccountPage(page: AccountPage): void;
}

// Choosing a tab starts the account tab again at its first page, so Compte never reopens on Véhicules.
function useTabs(): TabsController {
  const [tab, setTab] = useState<Tab>('lots');
  const [accountPage, setAccountPage] = useState<AccountPage>('account');
  function selectTab(next: Tab) {
    setTab(next);
    setAccountPage('account');
  }
  // The scan tab sends a driver without plate or card straight to the page that adds one.
  function openAccountPage(page: AccountPage) {
    setTab('account');
    setAccountPage(page);
  }
  return { tab, accountPage, selectTab, setAccountPage, openAccountPage };
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
