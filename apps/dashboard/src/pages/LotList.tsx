import { useEffect, useRef } from 'react';
import type { DashboardLot } from '@palier/shared-types';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource, type Resource } from '../api/useResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { RetryableFailure } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { LotStateMark } from '../components/LotStateMark.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { lotPath, NEW_LOT_PATH } from '../navigation/routes.ts';

const LOADING_ROWS = 2;

export function LotList() {
  const text = useText();
  const { resource: lots, reload, isReloading } = useResource(dashboardClient.lots);
  const titleRef = useFocusTitleOnRecovery(lots);
  return (
    <section className="section" aria-labelledby="lots-title">
      <h2 id="lots-title" ref={titleRef} tabIndex={-1} className="section-title">
        {text.home.lotsTitle}
      </h2>
      <AppLink href={NEW_LOT_PATH} className="text-link">
        {text.home.createLot}
      </AppLink>
      <LotListContent lots={lots} onRetry={reload} isRetrying={isReloading} />
    </section>
  );
}

// After a failure the retry button is gone with the failure block, so focus moves to the list's title.
function useFocusTitleOnRecovery(lots: Resource<readonly DashboardLot[]>) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const hasFailed = useRef(false);
  useEffect(() => {
    if (lots.status === 'failed') {
      hasFailed.current = true;
    } else if (lots.status === 'ready' && hasFailed.current) {
      hasFailed.current = false;
      titleRef.current?.focus();
    }
  }, [lots.status]);
  return titleRef;
}

interface LotListContentProps {
  readonly lots: Resource<readonly DashboardLot[]>;
  readonly onRetry: () => void;
  readonly isRetrying: boolean;
}

function LotListContent({ lots, onRetry, isRetrying }: LotListContentProps) {
  const text = useText();
  if (lots.status === 'loading') {
    return <SkeletonRows count={LOADING_ROWS} label={text.home.lotsLoading} />;
  }
  if (lots.status === 'failed') {
    return <RetryableFailure code={lots.error.code} onRetry={onRetry} isRetrying={isRetrying} />;
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
  return (
    <li className="row">
      <AppLink href={lotPath(lot.id)} className="row-link">
        <span className="row-name">{lot.name}</span>
        <LotStateMark isOnline={lot.isOnline} />
      </AppLink>
    </li>
  );
}
