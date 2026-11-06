import { useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SignedInClients } from '../api/SignedInClients';
import { rememberingAnswer } from '../deviceLocation/LocationExplanationStore';
import { TabBar } from '../components/TabBar';
import { usePendingEntryWatch, type PendingEntryWatch } from '../entries/usePendingEntryWatch';
import { useTabs, type TabsController } from '../navigation/useTabs';
import { useCurrentParkingSession, type CurrentParkingSessionController } from '../parkingSessions/useCurrentParkingSession';
import type { PositioningCore } from '../positioning/PositioningCore';
import { useSpotHold, type SpotHoldController } from '../spotHolds/useSpotHold';
import { AccountTab } from './AccountTab';
import { AutomaticDetectionNotice } from './AutomaticDetectionNotice';
import type { DeveloperEntry } from './DeveloperEntry';
import { HomeScreen } from './HomeScreen';
import { ScannerGate } from './ScannerGate';
import { ScanTab, scanTabLabels } from './ScanTab';
import { useParkingGuidance } from './useParkingGuidance';

interface SignedInTabsProps {
  readonly firstName: string;
  readonly clients: SignedInClients;
  readonly developerEntry: DeveloperEntry | undefined;
  readonly positioning: PositioningCore;
  readonly onSignOut: () => void;
}

// The current session and the spot hold are read here, above the tabs, so a relaunch finds them before any tab is opened;
// the lot list reads the hold again with every list.
export function SignedInTabs({ firstName, clients, developerEntry, positioning, onSignOut }: SignedInTabsProps) {
  const tabs = useTabs();
  const currentSession = useCurrentParkingSession(clients.parkingSession, tabs.openScanUnlessChosen);
  const spotHold = useSpotHold(clients.spotHold);
  const pendingEntry = usePendingEntryWatch(clients.entry, { onSettled: currentSession.refresh, onSubmissionEnded: spotHold.refreshHold });
  const gateScanner = useScannerGate(clients);
  const plan = useParkingGuidance(positioning, currentSession.state);
  const content = { firstName, clients, developerEntry, onSignOut, tabs, currentSession, pendingEntry, spotHold, gateScanner, plan };
  return (
    <View style={styles.app}>
      <TabContent {...content} />
      <TabBar selected={tabs.tab} onSelect={tabs.selectTab} labels={scanTabLabels(currentSession.state)} />
    </View>
  );
}

// The answer is remembered here, above the tabs, so a flag that could not be saved is not asked again on a tab switch.
function useScannerGate({ locationExplanation, backgroundLocation }: SignedInClients): (scanner: ReactElement) => ReactElement {
  const store = useMemo(() => rememberingAnswer(locationExplanation), [locationExplanation]);
  return useCallback(
    (scanner) => (
      <ScannerGate store={store} location={backgroundLocation}>
        {scanner}
      </ScannerGate>
    ),
    [store, backgroundLocation],
  );
}

interface TabContentProps extends Omit<SignedInTabsProps, 'positioning'> {
  readonly tabs: TabsController;
  readonly currentSession: CurrentParkingSessionController;
  readonly pendingEntry: PendingEntryWatch;
  readonly spotHold: SpotHoldController;
  readonly gateScanner: (scanner: ReactElement) => ReactElement;
  readonly plan: ReactNode;
}

function TabContent({ firstName, clients, tabs, currentSession, pendingEntry, spotHold, gateScanner, plan, developerEntry, onSignOut }: TabContentProps) {
  switch (tabs.tab) {
    case 'lots':
      return <HomeScreen firstName={firstName} lotsClient={clients.lots} locationClient={clients.location} spotHold={spotHold} />;
    case 'scan':
      return (
        <ScanTab
          entryClient={clients.entry}
          gateScanner={gateScanner}
          aside={{ detectionNotice: <AutomaticDetectionNotice location={clients.backgroundLocation} />, plan }}
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
