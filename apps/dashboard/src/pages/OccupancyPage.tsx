import type { DashboardLotOccupancy } from '@palier/shared-types';
import { SPOT_STATES } from '@palier/shared-types/spotStates';
import { useCallback, useId } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DashboardApiError } from '../api/DashboardApiError.ts';
import { usePolledResource } from '../api/usePolledResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { CountedText } from '../components/CountedText.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { StaleNote } from '../components/StaleNote.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { pluralFormOf } from '../i18n/plural.ts';
import { lotPath } from '../navigation/routes.ts';
import { NotFoundPage } from './NotFoundPage.tsx';
import { SilentGatesBanner } from './SilentGatesBanner.tsx';

const POLL_INTERVAL_MILLISECONDS = 30_000;
const LOADING_ROWS = 3;
const LOT_NOT_FOUND = 'LOT_NOT_FOUND';

const isLotGone = (error: DashboardApiError): boolean => error.code === LOT_NOT_FOUND;

type Levels = DashboardLotOccupancy['levels'];

export function OccupancyPage({ lotId }: { readonly lotId: string }) {
  const occupancy = usePolledResource(useCallback(() => dashboardClient.lotOccupancy(lotId), [lotId]), POLL_INTERVAL_MILLISECONDS, isLotGone);
  if (occupancy.status === 'loading') {
    return <OccupancyLoading />;
  }
  if (occupancy.status === 'failed') {
    return isLotGone(occupancy.error) ? <NotFoundPage /> : <OccupancyUnavailable lotId={lotId} {...occupancy} />;
  }
  return <OccupancyView occupancy={occupancy.value} isStale={occupancy.isStale} updatedAt={occupancy.updatedAt} />;
}

function OccupancyLoading() {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.occupancy.title} />
      <SkeletonRows count={LOADING_ROWS} label={text.app.loading} />
    </>
  );
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

interface OccupancyViewProps {
  readonly occupancy: DashboardLotOccupancy;
  readonly isStale: boolean;
  readonly updatedAt: Date;
}

function OccupancyView({ occupancy, isStale, updatedAt }: OccupancyViewProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={`${text.occupancy.title} — ${occupancy.lotName}`} />
      <StaleNote isStale={isStale} updatedAt={updatedAt} />
      <SilentGatesBanner lotId={occupancy.lotId} gateNames={occupancy.silentGateNames} />
      <CounterSummary occupancy={occupancy} />
      {occupancy.levels.length === 0 ? <p className="muted">{text.occupancy.noLevels}</p> : <LevelsTable levels={occupancy.levels} />}
      <AppLink href={lotPath(occupancy.lotId)} className="text-link">
        {text.occupancy.back}
      </AppLink>
    </>
  );
}

function CounterSummary({ occupancy }: { readonly occupancy: DashboardLotOccupancy }) {
  const text = useText();
  return (
    <section className="section" aria-labelledby="counter-title">
      <h2 id="counter-title" className="section-title">
        {text.occupancy.counterTitle}
      </h2>
      <p className="count-line">
        <CountedText template={text.occupancy.vehicleCount} count={occupancy.vehicleCount} />
      </p>
      <p className="count-line">
        <CountedText template={text.occupancy.occupiedOrAssigned} count={occupancy.occupiedOrAssignedCount} />
      </p>
      <CounterGapLine gap={occupancy.counterGap} hasSpots={totalSpotsOf(occupancy.levels) > 0} />
    </section>
  );
}

function totalSpotsOf(levels: Levels): number {
  return levels.reduce((total, { counts }) => total + SPOT_STATES.reduce((levelTotal, state) => levelTotal + counts[state], 0), 0);
}

// With no spot there is nothing to compare the counter to, so the gap would only repeat the counter.
function CounterGapLine({ gap, hasSpots }: { readonly gap: DashboardLotOccupancy['counterGap']; readonly hasSpots: boolean }) {
  const { text, language } = useLanguage();
  if (!hasSpots) {
    return <p className="muted">{text.occupancy.noSpots}</p>;
  }
  const isBelow = gap.kind === 'COUNTER_BELOW';
  const template = isBelow ? text.occupancy.counterBelow : pluralFormOf(text.occupancy.spotsToCheck, gap.spots, language);
  const sentence = <CountedText template={template} count={gap.spots} figureClassName="gap-figure" />;
  return <p className="gap-line">{isBelow ? <StateMark tone="danger" label={sentence} wraps /> : sentence}</p>;
}

function LevelsTable({ levels }: { readonly levels: Levels }) {
  const text = useText();
  const titleId = useId();
  return (
    <section className="section">
      <h2 id={titleId} className="section-title">
        {text.occupancy.levelsTitle}
      </h2>
      <div className="table-scroll" role="region" aria-labelledby={titleId} tabIndex={0}>
        <table className="level-table">
          <caption className="visually-hidden">{text.occupancy.tableCaption}</caption>
          <LevelsHead levels={levels} />
          <LevelsBody levels={levels} />
        </table>
      </div>
    </section>
  );
}

function LevelsHead({ levels }: { readonly levels: Levels }) {
  const text = useText();
  return (
    <thead>
      <tr>
        <th scope="col">
          <span className="visually-hidden">{text.occupancy.stateHeader}</span>
        </th>
        {levels.map(({ code }) => (
          <th key={code} scope="col" className="figure">
            {code}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function LevelsBody({ levels }: { readonly levels: Levels }) {
  const { text, language } = useLanguage();
  return (
    <tbody>
      {SPOT_STATES.map((state) => (
        <tr key={state}>
          <th scope="row">{text.spotStates[state]}</th>
          {levels.map(({ code, counts }) => (
            <td key={code} className="figure">
              {formatCount(counts[state], language)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
