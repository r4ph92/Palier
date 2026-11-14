import type { DashboardLotMap } from '@palier/shared-types';
import { AppLink } from '../components/AppLink.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure, type RetryableFailureProps } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { AislesSection } from '../lotMap/AislesSection.tsx';
import { BeaconTable } from '../lotMap/BeaconTable.tsx';
import { LevelsSection } from '../lotMap/LevelsSection.tsx';
import { SpotsSection } from '../lotMap/SpotsSection.tsx';
import { useLotMap } from '../lotMap/useLotMap.ts';
import { lotPath } from '../navigation/routes.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

const LOADING_ROWS = 3;

export function MapPage({ lotId }: { readonly lotId: string }) {
  const { resource, reload, isReloading, latest, show, refresh } = useLotMap(lotId);
  if (resource.status === 'loading') {
    return <MapLoading />;
  }
  if (resource.status === 'failed') {
    return resource.error.code === 'LOT_NOT_FOUND' ? <NotFoundPage /> : <MapUnavailable lotId={lotId} code={resource.error.code} onRetry={reload} isRetrying={isReloading} />;
  }
  return <MapView map={latest ?? resource.value} onSaved={show} onStale={refresh} />;
}

function MapLoading() {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.map.title} />
      <SkeletonRows count={LOADING_ROWS} label={text.app.loading} />
    </>
  );
}

function MapUnavailable({ lotId, ...failure }: RetryableFailureProps & { readonly lotId: string }) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.map.unavailableTitle} />
      <div className="actions-row">
        <RetryableFailure {...failure} />
        <AppLink href={lotPath(lotId)} className="text-link">
          {text.map.back}
        </AppLink>
      </div>
    </>
  );
}

interface MapViewProps {
  readonly map: DashboardLotMap;
  readonly onSaved: (map: DashboardLotMap) => void;
  readonly onStale: () => Promise<boolean>;
}

function MapView({ map, onSaved, onStale }: MapViewProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={`${text.map.title} — ${map.lotName}`} />
      <LevelsSection map={map} onSaved={onSaved} onStale={onStale} />
      <AislesSection map={map} onSaved={onSaved} />
      <SpotsSection map={map} onStale={onStale} />
      <BeaconTable map={map} />
      <AppLink href={lotPath(map.lotId)} className="text-link">
        {text.map.back}
      </AppLink>
    </>
  );
}
