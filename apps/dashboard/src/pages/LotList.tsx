import type { DashboardLot } from '@palier/shared-types';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useResource } from '../api/useResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { LotStateMark } from '../components/LotStateMark.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { lotPath } from '../navigation/routes.ts';

const LOADING_ROWS = 2;

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
  const { resource: lots, reload } = useResource(dashboardClient.lots);
  if (lots.status === 'loading') {
    return <SkeletonRows count={LOADING_ROWS} label={text.home.lotsLoading} />;
  }
  if (lots.status === 'failed') {
    return <LotListFailure code={lots.error.code} onRetry={reload} />;
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

function LotListFailure({ code, onRetry }: { readonly code: DisplayedErrorCode; readonly onRetry: () => void }) {
  const text = useText();
  return (
    <>
      <ErrorNotice code={code} />
      <button type="button" className="text-button" onClick={onRetry}>
        {text.failure.retry}
      </button>
    </>
  );
}

function LotRow({ lot }: { readonly lot: DashboardLot }) {
  return (
    <li className="row">
      <AppLink href={lotPath(lot.id)} className="row-link">
        <span className="row-name">{lot.name}</span>
        <LotStateMark isOnline={lot.isOnline} />
      </AppLink>
    </li>
  );
}
