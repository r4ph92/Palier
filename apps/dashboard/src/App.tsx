import type { DashboardMeResponse, DashboardOperator } from '@palier/shared-types';
import { AppHeader } from './components/AppHeader.tsx';
import { LanguageProvider } from './i18n/LanguageContext.tsx';
import { NavigationProvider, useNavigation } from './navigation/NavigationContext.tsx';
import { PageFocusProvider } from './navigation/PageFocusContext.tsx';
import type { Route } from './navigation/routes.ts';
import { CreateLotPage } from './pages/CreateLotPage.tsx';
import { CreateOperatorPage } from './pages/CreateOperatorPage.tsx';
import { EquipmentPage } from './pages/EquipmentPage.tsx';
import { ExitsPage } from './pages/ExitsPage.tsx';
import { GatesPage } from './pages/GatesPage.tsx';
import { LoadingPage } from './pages/LoadingPage.tsx';
import { LotPage } from './pages/LotPage.tsx';
import { MapPage } from './pages/MapPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { OccupancyPage } from './pages/OccupancyPage.tsx';
import { OperatorHomePage } from './pages/OperatorHomePage.tsx';
import { PublicationPage } from './pages/PublicationPage.tsx';
import { SessionPage } from './pages/SessionPage.tsx';
import { SessionsPage } from './pages/SessionsPage.tsx';
import { SignInPage } from './pages/SignInPage.tsx';
import { StaleSessionsPage } from './pages/StaleSessionsPage.tsx';
import { SpotsToCheckPage } from './pages/SpotsToCheckPage.tsx';
import { UnreachablePage } from './pages/UnreachablePage.tsx';
import { SessionRefreshContext } from './session/SessionRefreshContext.tsx';
import { useDashboardSession, type Session } from './session/useDashboardSession.ts';

export function App() {
  return (
    <LanguageProvider>
      <NavigationProvider>
        <PageFocusProvider>
          <DashboardShell />
        </PageFocusProvider>
      </NavigationProvider>
    </LanguageProvider>
  );
}

function DashboardShell() {
  const { session, refresh, signOut } = useDashboardSession();
  return (
    <>
      <AppHeader onSignOut={session.status === 'signedIn' ? signOut : null} />
      <main id="content" className="page">
        <SessionRefreshContext.Provider value={refresh}>
          <SessionContent session={session} refresh={refresh} />
        </SessionRefreshContext.Provider>
      </main>
    </>
  );
}

interface SessionContentProps {
  readonly session: Session;
  readonly refresh: () => Promise<void>;
}

function SessionContent({ session, refresh }: SessionContentProps) {
  switch (session.status) {
    case 'loading':
      return <LoadingPage />;
    case 'signedOut':
      return <SignInPage onSignedIn={refresh} />;
    case 'unreachable':
      return <UnreachablePage onRetry={refresh} />;
    case 'signedIn':
      return <SignedInContent me={session.me} refresh={refresh} />;
  }
}

// Without an operator there is nothing to show but its creation, whatever the address asked for.
function SignedInContent({ me, refresh }: { readonly me: DashboardMeResponse; readonly refresh: () => Promise<void> }) {
  const { route } = useNavigation();
  if (route.page === 'notFound') {
    return <NotFoundPage />;
  }
  if (me.operator === null) {
    return <CreateOperatorPage firstName={me.user.firstName} onCreated={refresh} />;
  }
  return <OperatorPage route={route} operator={me.operator} />;
}

function OperatorPage({ route, operator }: { readonly route: Exclude<Route, { page: 'notFound' }>; readonly operator: DashboardOperator }) {
  switch (route.page) {
    case 'home':
      return <OperatorHomePage operator={operator} />;
    case 'newLot':
      return <CreateLotPage />;
    case 'lot':
      return <LotPage key={route.lotId} lotId={route.lotId} />;
    default:
      return <LotSubpageOf key={route.lotId} route={route} />;
  }
}

type LotSubpageRoute = Exclude<Route, { page: 'notFound' | 'home' | 'newLot' | 'lot' }>;

function LotSubpageOf({ route }: { readonly route: LotSubpageRoute }) {
  switch (route.page) {
    case 'occupancy':
      return <OccupancyPage lotId={route.lotId} />;
    case 'map':
      return <MapPage lotId={route.lotId} />;
    case 'spotsToCheck':
      return <SpotsToCheckPage lotId={route.lotId} />;
    case 'equipment':
      return <EquipmentPage lotId={route.lotId} />;
    case 'gates':
      return <GatesPage lotId={route.lotId} />;
    case 'publication':
      return <PublicationPage lotId={route.lotId} />;
    case 'exits':
      return <ExitsPage lotId={route.lotId} />;
    default:
      return <SessionSubpageOf route={route} />;
  }
}

function SessionSubpageOf({ route }: { readonly route: Extract<Route, { page: 'sessions' | 'staleSessions' | 'session' }> }) {
  switch (route.page) {
    case 'sessions':
      return <SessionsPage lotId={route.lotId} />;
    case 'staleSessions':
      return <StaleSessionsPage lotId={route.lotId} />;
    case 'session':
      return <SessionPage lotId={route.lotId} sessionId={route.sessionId} />;
  }
}
