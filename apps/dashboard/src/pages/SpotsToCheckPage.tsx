import type { DashboardSpotsToCheck } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource } from '../api/useResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure, type RetryableFailureProps } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { pluralOf } from '../i18n/plural.ts';
import { SpotPager } from '../lotMap/SpotPager.tsx';
import { useSpotPage } from '../lotMap/useSpotPage.ts';
import { lotPath } from '../navigation/routes.ts';
import { SPOT_CHECK_STATUS_ID } from '../spotsToCheck/spotCheckIds.ts';
import { SpotsToCheckTable } from '../spotsToCheck/SpotsToCheckTable.tsx';
import { useSpotCheckClearing, type SpotCheckClearing } from '../spotsToCheck/useSpotCheckClearing.ts';
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

const COUNT_ID = 'spots-to-check-count';

function SpotsToCheckView({ lotId, initial }: { readonly lotId: string; readonly initial: DashboardSpotsToCheck }) {
  const { spotsToCheck: text, lot } = useText();
  const clearing = useSpotCheckClearing(lotId, initial);
  return (
    <>
      <PageHeader eyebrow={lot.eyebrow} title={interpolate(text.titleInLot, { lot: initial.lotName })} />
      <ClearedStatus number={clearing.clearedNumber} />
      {clearing.spots.length === 0 ? <EmptyList /> : <FlaggedSpots clearing={clearing} />}
      <BackLink lotId={lotId} />
    </>
  );
}

function FlaggedSpots({ clearing }: { readonly clearing: SpotCheckClearing }) {
  const { text, language } = useLanguage();
  const page = useSpotPage(clearing.spots, noop);
  return (
    <>
      <p id={COUNT_ID} className="number-cell">
        {pluralOf(text.spotsToCheck.count, clearing.spots.length, language)}
      </p>
      <p className="muted">{text.spotsToCheck.hint}</p>
      <SpotPager page={page} />
      <SpotsToCheckTable spots={page.spots} clearing={clearing} labelledBy={COUNT_ID} />
    </>
  );
}

function noop(): void {}

// The line takes focus when the last flag is cleared, since the button that had it is gone.
function ClearedStatus({ number }: { readonly number: string | null }) {
  const { spotsToCheck: text } = useText();
  return (
    <p role="status" id={SPOT_CHECK_STATUS_ID} tabIndex={-1} className="check-status">
      {number === null ? null : <StateMark tone="free" label={interpolate(text.cleared, { number })} />}
    </p>
  );
}

function EmptyList() {
  const { spotsToCheck: text } = useText();
  return (
    <>
      <p>{text.empty}</p>
      <p className="muted">{text.emptyHint}</p>
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
