import type { DashboardLotOccupancy } from '@palier/shared-types';
import { SPOT_STATES } from '@palier/shared-types/spotStates';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DashboardApiError } from '../api/DashboardApiError.ts';
import { usePolledResource } from '../api/usePolledResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { Fact } from '../components/Fact.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure } from '../components/RetryableFailure.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { pluralOf } from '../i18n/plural.ts';
import { lotPath } from '../navigation/routes.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

const POLL_INTERVAL_MILLISECONDS = 30_000;

export function OccupancyPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const occupancy = usePolledResource(useCallback(() => dashboardClient.lotOccupancy(lotId), [lotId]), POLL_INTERVAL_MILLISECONDS);
  if (occupancy.status === 'loading') {
    return <p role="status" className="muted">{text.app.loading}</p>;
  }
  if (occupancy.status === 'failed') {
    return occupancy.error.code === 'LOT_NOT_FOUND' ? <NotFoundPage /> : <OccupancyUnavailable lotId={lotId} {...occupancy} />;
  }
  return <OccupancyView occupancy={occupancy.value} isStale={occupancy.isStale} />;
}

interface OccupancyUnavailableProps {
  readonly lotId: string;
  readonly error: DashboardApiError;
  readonly retry: () => void;
  readonly isRetrying: boolean;
}

function OccupancyUnavailable({ lotId, error, retry, isRetrying }: OccupancyUnavailableProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.occupancy.title} />
      <div className="actions-row">
        <RetryableFailure code={error.code} onRetry={retry} isRetrying={isRetrying} />
        <AppLink href={lotPath(lotId)} className="text-link">
          {text.occupancy.back}
        </AppLink>
      </div>
    </>
  );
}

function OccupancyView({ occupancy, isStale }: { readonly occupancy: DashboardLotOccupancy; readonly isStale: boolean }) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={`${text.occupancy.title} — ${occupancy.lotName}`} />
      {isStale ? <p role="status" className="muted">{text.occupancy.stale}</p> : null}
      <CounterSummary occupancy={occupancy} />
      {occupancy.levels.length === 0 ? <p className="muted">{text.occupancy.noLevels}</p> : occupancy.levels.map((level) => <LevelSection key={level.code} level={level} />)}
      <AppLink href={lotPath(occupancy.lotId)} className="text-link">
        {text.occupancy.back}
      </AppLink>
    </>
  );
}

function CounterSummary({ occupancy }: { readonly occupancy: DashboardLotOccupancy }) {
  const { text, language } = useLanguage();
  const countLine = (template: string, count: number) => <p className="count-line">{interpolate(template, { count: formatCount(count, language) })}</p>;
  return (
    <section className="section" aria-labelledby="counter-title">
      <h2 id="counter-title" className="section-title">
        {text.occupancy.counterTitle}
      </h2>
      {countLine(text.occupancy.vehicleCount, occupancy.vehicleCount)}
      {countLine(text.occupancy.occupiedOrAssigned, occupancy.occupiedOrAssignedCount)}
      <CounterGapLine gap={occupancy.counterGap} />
    </section>
  );
}

function CounterGapLine({ gap }: { readonly gap: DashboardLotOccupancy['counterGap'] }) {
  const { text, language } = useLanguage();
  if (gap.kind === 'COUNTER_BELOW') {
    return (
      <p className="gap-line">
        <StateMark tone="danger" label={interpolate(text.occupancy.counterBelow, { count: formatCount(gap.spots, language) })} wraps />
      </p>
    );
  }
  return <p className="gap-line">{pluralOf(text.occupancy.spotsToCheck, gap.spots, language)}</p>;
}

function LevelSection({ level }: { readonly level: DashboardLotOccupancy['levels'][number] }) {
  const { text, language } = useLanguage();
  const titleId = `level-${level.code}`;
  return (
    <section className="section" aria-labelledby={titleId}>
      <h2 id={titleId} className="section-title">
        {interpolate(text.occupancy.level, { code: level.code })}
      </h2>
      <dl className="facts">
        {SPOT_STATES.map((state) => (
          <Fact key={state} label={text.spotStates[state]} numeric>
            {formatCount(level.counts[state], language)}
          </Fact>
        ))}
      </dl>
    </section>
  );
}
