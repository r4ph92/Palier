import type { DashboardMeResponse } from '@palier/shared-types';
import { AppHeader } from './components/AppHeader.tsx';
import { LanguageProvider, useText } from './i18n/LanguageContext.tsx';
import { NavigationProvider, useNavigation } from './navigation/NavigationContext.tsx';
import { CreateOperatorPage } from './pages/CreateOperatorPage.tsx';
import { LotPage } from './pages/LotPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { OperatorHomePage } from './pages/OperatorHomePage.tsx';
import { SignInPage } from './pages/SignInPage.tsx';
import { UnreachablePage } from './pages/UnreachablePage.tsx';
import { useDashboardSession, type Session } from './session/useDashboardSession.ts';

export function App() {
  return (
    <LanguageProvider>
      <NavigationProvider>
        <DashboardShell />
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
        <SessionContent session={session} refresh={refresh} />
      </main>
    </>
  );
}

interface SessionContentProps {
  readonly session: Session;
  readonly refresh: () => Promise<void>;
}

function SessionContent({ session, refresh }: SessionContentProps) {
  const text = useText();
  switch (session.status) {
    case 'loading':
      return <p role="status" className="muted">{text.app.loading}</p>;
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
  return route.page === 'lot' ? <LotPage key={route.lotId} lotId={route.lotId} /> : <OperatorHomePage operator={me.operator} />;
}
