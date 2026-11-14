import type { DashboardLotEquipment } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DashboardApiError } from '../api/DashboardApiError.ts';
import { usePolledResource } from '../api/usePolledResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { StaleNote } from '../components/StaleNote.tsx';
import { GatesSection } from '../equipment/GatesSection.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { lotPath, mapPath } from '../navigation/routes.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

// As often as the occupancy page: a gate is silent after 2 minutes, so the page shows it within 2 and a half.
const POLL_INTERVAL_MILLISECONDS = 30_000;
const LOADING_ROWS = 2;

const isLotGone = (error: DashboardApiError): boolean => error.code === 'LOT_NOT_FOUND';

export function EquipmentPage({ lotId }: { readonly lotId: string }) {
  const equipment = usePolledResource(useCallback(() => dashboardClient.lotEquipment(lotId), [lotId]), POLL_INTERVAL_MILLISECONDS, isLotGone);
  if (equipment.status === 'loading') {
    return <EquipmentLoading />;
  }
  if (equipment.status === 'failed') {
    return isLotGone(equipment.error) ? <NotFoundPage /> : <EquipmentUnavailable lotId={lotId} {...equipment} />;
  }
  return <EquipmentView equipment={equipment.value} isStale={equipment.isStale} updatedAt={equipment.updatedAt} />;
}

function EquipmentLoading() {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.equipment.title} />
      <SkeletonRows count={LOADING_ROWS} label={text.app.loading} />
    </>
  );
}

interface EquipmentUnavailableProps {
  readonly lotId: string;
  readonly error: DashboardApiError;
  readonly retry: () => void;
  readonly isRetrying: boolean;
}

function EquipmentUnavailable({ lotId, error, retry, isRetrying }: EquipmentUnavailableProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.equipment.unavailableTitle} />
      <div className="actions-row">
        <RetryableFailure code={error.code} onRetry={retry} isRetrying={isRetrying} />
        <AppLink href={lotPath(lotId)} className="text-link">
          {text.equipment.back}
        </AppLink>
      </div>
    </>
  );
}

interface EquipmentViewProps {
  readonly equipment: DashboardLotEquipment;
  readonly isStale: boolean;
  readonly updatedAt: Date;
}

function EquipmentView({ equipment, isStale, updatedAt }: EquipmentViewProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={`${text.equipment.title} — ${equipment.lotName}`} />
      <StaleNote isStale={isStale} updatedAt={updatedAt} />
      <GatesSection equipment={equipment} />
      <p className="lead">
        {text.equipment.batteriesNote}{' '}
        <AppLink href={mapPath(equipment.lotId)} className="text-link">
          {text.equipment.batteriesLink}
        </AppLink>
      </p>
      <AppLink href={lotPath(equipment.lotId)} className="text-link">
        {text.equipment.back}
      </AppLink>
    </>
  );
}
