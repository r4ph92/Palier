import type { ReactElement } from 'react';
import type { DashboardOperator } from '@palier/shared-types';
import type { Route } from '../navigation/routes.ts';
import { CreateLotPage } from './CreateLotPage.tsx';
import { EquipmentPage } from './EquipmentPage.tsx';
import { ExitsPage } from './ExitsPage.tsx';
import { GatesPage } from './GatesPage.tsx';
import { LotPage } from './LotPage.tsx';
import { MapPage } from './MapPage.tsx';
import { OccupancyPage } from './OccupancyPage.tsx';
import { OperatorHomePage } from './OperatorHomePage.tsx';
import { PublicationPage } from './PublicationPage.tsx';
import { SessionPage } from './SessionPage.tsx';
import { SessionsPage } from './SessionsPage.tsx';
import { SpotsToCheckPage } from './SpotsToCheckPage.tsx';
import { StaleSessionsPage } from './StaleSessionsPage.tsx';

type OperatorRoute = Exclude<Route, { page: 'notFound' }>;
type Page = OperatorRoute['page'];

interface OperatorPageProps {
  readonly route: OperatorRoute;
  readonly operator: DashboardOperator;
}

// A missing entry fails the type check, so a new route cannot ship without its page. A lot's pages are keyed by lot to reset on a switch.
const PAGES: { readonly [P in Page]: (route: Extract<OperatorRoute, { page: P }>, operator: DashboardOperator) => ReactElement } = {
  home: (_route, operator) => <OperatorHomePage operator={operator} />,
  newLot: () => <CreateLotPage />,
  lot: ({ lotId }) => <LotPage key={lotId} lotId={lotId} />,
  occupancy: ({ lotId }) => <OccupancyPage key={lotId} lotId={lotId} />,
  map: ({ lotId }) => <MapPage key={lotId} lotId={lotId} />,
  spotsToCheck: ({ lotId }) => <SpotsToCheckPage key={lotId} lotId={lotId} />,
  equipment: ({ lotId }) => <EquipmentPage key={lotId} lotId={lotId} />,
  gates: ({ lotId }) => <GatesPage key={lotId} lotId={lotId} />,
  publication: ({ lotId }) => <PublicationPage key={lotId} lotId={lotId} />,
  exits: ({ lotId }) => <ExitsPage key={lotId} lotId={lotId} />,
  sessions: ({ lotId }) => <SessionsPage key={lotId} lotId={lotId} />,
  staleSessions: ({ lotId }) => <StaleSessionsPage key={lotId} lotId={lotId} />,
  session: ({ lotId, sessionId }) => <SessionPage key={lotId} lotId={lotId} sessionId={sessionId} />,
};

export function OperatorPage({ route, operator }: OperatorPageProps) {
  return renderPage(route, operator);
}

function renderPage<P extends Page>(route: Extract<OperatorRoute, { page: P }>, operator: DashboardOperator): ReactElement {
  return PAGES[route.page as P](route, operator);
}
