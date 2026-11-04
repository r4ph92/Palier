import type { DashboardLot } from '@palier/shared-types';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource } from '../api/useResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { lotPath } from '../navigation/routes.ts';

export function LotList() {
  const text = useText();
  return (
    <section className="section" aria-labelledby="lots-title">
      <h2 id="lots-title" className="section-title">
        {text.home.lotsTitle}
      </h2>
      <LotListContent />
    </section>
  );
}

function LotListContent() {
  const text = useText();
  const lots = useResource(dashboardClient.lots);
  if (lots.status === 'loading') {
    return <p role="status" className="muted">{text.home.lotsLoading}</p>;
  }
  if (lots.status === 'failed') {
    return <ErrorNotice code={lots.error.code} />;
  }
  if (lots.value.length === 0) {
    return <p className="muted">{text.home.lotsEmpty}</p>;
  }
  return (
    <ul className="row-list">
      {lots.value.map((lot) => (
        <LotRow key={lot.id} lot={lot} />
      ))}
    </ul>
  );
}

function LotRow({ lot }: { readonly lot: DashboardLot }) {
  const text = useText();
  return (
    <li className="row">
      <AppLink href={lotPath(lot.id)} className="row-link">
        <span className="row-name">{lot.name}</span>
        <StateMark tone={lot.isOnline ? 'free' : 'muted'} label={lot.isOnline ? text.lot.online : text.lot.offline} />
      </AppLink>
    </li>
  );
}
