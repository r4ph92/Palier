import { useCallback, useRef, useState } from 'react';
import type { Tab } from '../components/TabBar';
import type { AccountPage } from '../screens/AccountTab';

export interface TabsController {
  readonly tab: Tab;
  readonly accountPage: AccountPage;
  selectTab(next: Tab): void;
  setAccountPage(page: AccountPage): void;
  openAccountPage(page: AccountPage): void;
  openScanUnlessChosen(): void;
}

// Choosing a tab starts the account tab again at its first page, so Compte never reopens on Véhicules.
// The scan tab sends a driver without plate or card straight to the page that adds one.
export function useTabs(): TabsController {
  const [tab, setTab] = useState<Tab>('lots');
  const [accountPage, setAccountPage] = useState<AccountPage>('account');
  const hasChosenTab = useRef(false);
  const choose = (next: Tab, page: AccountPage) => {
    hasChosenTab.current = true;
    setTab(next);
    setAccountPage(page);
  };
  // A driver already inside lands on their session, unless they picked a tab before Palier answered.
  const openScanUnlessChosen = useCallback(() => {
    if (!hasChosenTab.current) {
      setTab('scan');
    }
  }, []);
  const selectTab = (next: Tab) => choose(next, 'account');
  const openAccountPage = (page: AccountPage) => choose('account', page);
  return { tab, accountPage, selectTab, setAccountPage, openAccountPage, openScanUnlessChosen };
}
