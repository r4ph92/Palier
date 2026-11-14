import type { DashboardSpotToCheck } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource } from '../api/useResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure, type RetryableFailureProps } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { lotPath } from '../navigation/routes.ts';
import { SpotsToCheckTable } from '../spotsToCheck/SpotsToCheckTable.tsx';
import { useSpotCheckClearing } from '../spotsToCheck/useSpotCheckClearing.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

const LOADING_ROWS = 3;

export function SpotsToCheckPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const { resource, reload, isReloading } = useResource(useCallback(() => dashboardClient.spotsToCheck(lotId), [lotId]));
  if (resource.status === 'loading') {
    return (
      <>
        <PageHeader eyebrow={text.lot.eyebrow} title={text.spotsToCheck.title} />
        <SkeletonRows count={LOADING_ROWS} label={text.app.loading} />
      </>
    );
  }
  if (resource.status === 'failed') {
    return resource.error.code === 'LOT_NOT_FOUND' ? <NotFoundPage /> : <SpotsToCheckUnavailable lotId={lotId} code={resource.error.code} onRetry={reload} isRetrying={isReloading} />;
  }
  return <SpotsToCheckView lotId={lotId} initial={resource.value} />;
}

function SpotsToCheckUnavailable({ lotId, ...failure }: RetryableFailureProps & { readonly lotId: string }) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.spotsToCheck.title} />
      <div className="actions-row">
        <RetryableFailure {...failure} />
        <BackLink lotId={lotId} />
      </div>
    </>
  );
}

function SpotsToCheckView({ lotId, initial }: { readonly lotId: string; readonly initial: readonly DashboardSpotToCheck[] }) {
  const { spotsToCheck: text, lot } = useText();
  const clearing = useSpotCheckClearing(lotId, initial);
  return (
    <>
      <PageHeader eyebrow={lot.eyebrow} title={text.title} />
      <p className="muted">{text.hint}</p>
      <p role="status" className="muted">
        {clearing.clearedNumber === null ? null : interpolate(text.cleared, { number: clearing.clearedNumber })}
      </p>
      {clearing.spots.length === 0 ? <p className="muted">{text.empty}</p> : <SpotsToCheckTable clearing={clearing} />}
      <BackLink lotId={lotId} />
    </>
  );
}

function BackLink({ lotId }: { readonly lotId: string }) {
  const text = useText();
  return (
    <AppLink href={lotPath(lotId)} className="text-link">
      {text.spotsToCheck.back}
    </AppLink>
  );
}
