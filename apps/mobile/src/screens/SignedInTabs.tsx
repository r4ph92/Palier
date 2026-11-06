import { useCallback, useMemo, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SignedInClients } from '../api/SignedInClients';
import { rememberingAnswer } from '../deviceLocation/LocationExplanationStore';
import { TabBar, type Tab } from '../components/TabBar';
import { usePendingEntryWatch } from '../entries/usePendingEntryWatch';
import { useTabs, type TabsController } from '../navigation/useTabs';
import { useCurrentParkingSession, type CurrentParkingSessionController } from '../parkingSessions/useCurrentParkingSession';
import { useParkedPresumption } from '../parkingSessions/useParkedPresumption';
import { useAisleFollower } from '../positioning/useCurrentAisle';
import { useSpotHold } from '../spotHolds/useSpotHold';
import { AccountTab } from './AccountTab';
import { AutomaticDetectionNotice } from './AutomaticDetectionNotice';
import type { DeviceTools } from './DeviceTools';
import { HomeScreen } from './HomeScreen';
import { ScannerGate } from './ScannerGate';
import { ScanTab, scanTabLabels } from './ScanTab';
import { useParkingGuidance } from './useParkingGuidance';

interface SignedInTabsProps {
  readonly firstName: string;
  readonly clients: SignedInClients;
  readonly device: DeviceTools;
  readonly onSignOut: () => void;
}

type ScanTabActions = Pick<ComponentProps<typeof ScanTab>, 'entryClient' | 'onAddPlate' | 'onAddCard'>;

interface TabScreensWithSession {
  readonly currentSession: ReturnType<typeof useCurrentParkingSession>;
  readonly screens: TabScreens;
}

interface TabScreens {
  readonly home: ComponentProps<typeof HomeScreen>;
  readonly scan: ComponentProps<typeof ScanTab>;
  readonly account: ComponentProps<typeof AccountTab>;
}

// The current session and the spot hold are read here, above the tabs, so a relaunch finds them before any tab is opened;
// the lot list reads the hold again with every list.
export function SignedInTabs(props: SignedInTabsProps) {
  const tabs = useTabs();
  const { currentSession, screens } = useTabScreens(props, tabs);
  return (
    <View style={styles.app}>
      <TabContent tab={tabs.tab} {...screens} />
      <TabBar selected={tabs.tab} onSelect={tabs.selectTab} labels={scanTabLabels(currentSession.state)} />
    </View>
  );
}

function useTabScreens({ firstName, clients, device, onSignOut }: SignedInTabsProps, tabs: TabsController): TabScreensWithSession {
  const currentSession = useCurrentParkingSession(clients.parkingSession, tabs.openScanUnlessChosen);
  const spotHold = useSpotHold(clients.spotHold);
  const pendingEntry = usePendingEntryWatch(clients.entry, { onSettled: currentSession.refresh, onSubmissionEnded: spotHold.refreshHold });
  const gateScanner = useScannerGate(clients);
  const guidance = useSessionPositioning({ device, clients }, currentSession);
  const screens: TabScreens = {
    home: { firstName, lotsClient: clients.lots, locationClient: clients.location, spotHold },
    scan: {
      ...scanTabActions(clients, tabs),
      gateScanner,
      currentSession,
      pendingEntry,
      aside: { detectionNotice: <AutomaticDetectionNotice location={clients.backgroundLocation} />, guidance },
    },
    account: { firstName, page: tabs.accountPage, clients, developerEntry: device.developerEntry, onPageChange: tabs.setAccountPage, onSignOut },
  };
  return { currentSession, screens };
}

// The aisle and the walk away are followed above the tabs too, so a driver on another tab never misses them.
function useSessionPositioning({ device, clients }: Pick<SignedInTabsProps, 'device' | 'clients'>, currentSession: CurrentParkingSessionController): ReactNode {
  const aisles = useAisleFollower(device.positioning, currentSession.state);
  useParkedPresumption({ positioning: device.positioning, client: clients.parkingSession, aisles }, currentSession);
  return useParkingGuidance(device.positioning, aisles, currentSession.state);
}

function scanTabActions(clients: SignedInClients, tabs: TabsController): ScanTabActions {
  return {
    entryClient: clients.entry,
    onAddPlate: () => tabs.openAccountPage('vehicles'),
    onAddCard: () => tabs.openAccountPage('payment'),
  };
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

interface TabContentProps extends TabScreens {
  readonly tab: Tab;
}

function TabContent({ tab, home, scan, account }: TabContentProps) {
  switch (tab) {
    case 'lots':
      return <HomeScreen {...home} />;
    case 'scan':
      return <ScanTab {...scan} />;
    case 'account':
      return <AccountTab {...account} />;
  }
}

const styles = StyleSheet.create({
  app: { flex: 1 },
});
