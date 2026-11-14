import type { DashboardAisleSpots, DashboardMapAisle } from '@palier/shared-types';
import { RetryableFailure } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { AddSpotsForm } from './AddSpotsForm.tsx';
import { SpotList } from './SpotList.tsx';
import { useAisleSpots } from './useAisleSpots.ts';
import { useSpotChanges } from './useSpotChanges.ts';

const LOADING_ROWS = 3;

export interface AisleSpotsProps {
  readonly lotId: string;
  readonly aisle: DashboardMapAisle;
  // The aisle is gone from the map: the page reads the map again.
  readonly onStale: () => Promise<boolean>;
}

// The selected aisle's spots: loading, a failure with a retry, then the capacity warning, the add form and the list.
export function AisleSpots({ lotId, aisle, onStale }: AisleSpotsProps) {
  const text = useText();
  const { resource, reload, isReloading, latest, show, refresh } = useAisleSpots(lotId, aisle.id);
  const changes = useSpotChanges({ show, refresh, onStale });
  if (resource.status === 'loading') {
    return <SkeletonRows count={LOADING_ROWS} label={text.app.loading} />;
  }
  if (resource.status === 'failed') {
    return <RetryableFailure code={resource.error.code} onRetry={reload} isRetrying={isReloading} />;
  }
  const spots = latest ?? resource.value;
  return (
    <>
      <CapacityWarning spots={spots} />
      <AddSpotsForm lotId={lotId} aisleId={aisle.id} onAdded={(saved, count) => changes.added(saved, { count, aisle: aisle.code })} staleData={changes.staleData} />
      <SpotList lotId={lotId} aisle={aisle} spots={spots.spots} changes={changes} />
    </>
  );
}

// The capacity is entered with the lot and counts unmanaged spots too (#64), so more spots than capacity is a warning, not a refusal.
function CapacityWarning({ spots }: { readonly spots: DashboardAisleSpots }) {
  const { text, language } = useLanguage();
  if (spots.spotCount <= spots.capacity) {
    return null;
  }
  const values = { capacity: formatCount(spots.capacity, language), count: formatCount(spots.spotCount, language) };
  return (
    <p className="capacity-warning">
      <StateMark tone="danger" label={interpolate(text.map.spots.overCapacity, values)} wraps />
    </p>
  );
}
