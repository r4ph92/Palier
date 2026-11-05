import { StyleSheet, View } from 'react-native';
import type { SignedInClients } from '../api/SignedInClients';
import { TabBar } from '../components/TabBar';
import { usePendingEntryWatch, type PendingEntryWatch } from '../entries/usePendingEntryWatch';
import { useTabs, type TabsController } from '../navigation/useTabs';
import { useCurrentParkingSession, type CurrentParkingSessionController } from '../parkingSessions/useCurrentParkingSession';
import { AccountTab } from './AccountTab';
import type { DeveloperEntry } from './DeveloperEntry';
import { HomeScreen } from './HomeScreen';
import { ScanTab, scanTabLabels } from './ScanTab';

interface SignedInTabsProps {
  readonly firstName: string;
  readonly clients: SignedInClients;
  readonly developerEntry: DeveloperEntry | undefined;
  readonly onSignOut: () => void;
}

// The current session is read here, above the tabs, so a relaunch finds it before any tab is opened.
export function SignedInTabs({ firstName, clients, developerEntry, onSignOut }: SignedInTabsProps) {
  const tabs = useTabs();
  const currentSession = useCurrentParkingSession(clients.parkingSession, tabs.openScanUnlessChosen);
  const pendingEntry = usePendingEntryWatch(clients.entry, currentSession.refresh);
  const content = { firstName, clients, developerEntry, onSignOut, tabs, currentSession, pendingEntry };
  return (
    <View style={styles.app}>
      <TabContent {...content} />
      <TabBar selected={tabs.tab} onSelect={tabs.selectTab} labels={scanTabLabels(currentSession.state)} />
    </View>
  );
}

interface TabContentProps extends SignedInTabsProps {
  readonly tabs: TabsController;
  readonly currentSession: CurrentParkingSessionController;
  readonly pendingEntry: PendingEntryWatch;
}

function TabContent({ firstName, clients, tabs, currentSession, pendingEntry, developerEntry, onSignOut }: TabContentProps) {
  switch (tabs.tab) {
    case 'lots':
      return <HomeScreen firstName={firstName} lotsClient={clients.lots} locationClient={clients.location} />;
    case 'scan':
      return (
        <ScanTab
          entryClient={clients.entry}
          currentSession={currentSession}
          pendingEntry={pendingEntry}
          onAddPlate={() => tabs.openAccountPage('vehicles')}
          onAddCard={() => tabs.openAccountPage('payment')}
        />
      );
    case 'account':
      return <AccountTab firstName={firstName} page={tabs.accountPage} clients={clients} developerEntry={developerEntry} onPageChange={tabs.setAccountPage} onSignOut={onSignOut} />;
  }
}

const styles = StyleSheet.create({
  app: { flex: 1 },
});
