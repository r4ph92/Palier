import type { DashboardLotDetails } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource } from '../api/useResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { Fact } from '../components/Fact.tsx';
import { LotStateMark } from '../components/LotStateMark.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure, type RetryableFailureProps } from '../components/RetryableFailure.tsx';
import { formatCount, formatDegrees } from '../i18n/formatNumbers.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { equipmentPath, HOME_PATH, mapPath, occupancyPath } from '../navigation/routes.ts';
import { NotFoundPage } from './NotFoundPage.tsx';
import { PricingSection } from './PricingSection.tsx';

const MISSING = '—';

export function LotPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const { resource: lot, reload, isReloading } = useResource(useCallback(() => dashboardClient.lot(lotId), [lotId]));
  if (lot.status === 'loading') {
    return <p role="status" className="muted">{text.app.loading}</p>;
  }
  if (lot.status === 'failed') {
    return lot.error.code === 'LOT_NOT_FOUND' ? <NotFoundPage /> : <LotUnavailable code={lot.error.code} onRetry={reload} isRetrying={isReloading} />;
  }
  return <LotDetails lot={lot.value} onPricingSaved={reload} />;
}

function LotUnavailable(failure: RetryableFailureProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.lot.unavailableTitle} />
      <div className="actions-row">
        <RetryableFailure {...failure} />
        <AppLink href={HOME_PATH} className="text-link">
          {text.lot.back}
        </AppLink>
      </div>
    </>
  );
}

interface LotDetailsProps {
  readonly lot: DashboardLotDetails;
  readonly onPricingSaved: () => void;
}

function LotDetails({ lot, onPricingSaved }: LotDetailsProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={lot.name} />
      <LotFacts lot={lot} />
      <LotLinks lotId={lot.id} />
      <PricingSection lotId={lot.id} pricing={lot.pricing} onSaved={onPricingSaved} />
      <AppLink href={HOME_PATH} className="text-link">
        {text.lot.back}
      </AppLink>
    </>
  );
}

function LotLinks({ lotId }: { readonly lotId: string }) {
  const text = useText();
  return (
    <p className="actions-row">
      <AppLink href={occupancyPath(lotId)} className="text-link">
        {text.lot.occupancyLink}
      </AppLink>
      <AppLink href={mapPath(lotId)} className="text-link">
        {text.lot.mapLink}
      </AppLink>
      <AppLink href={equipmentPath(lotId)} className="text-link">
        {text.lot.equipmentLink}
      </AppLink>
    </p>
  );
}

function LotFacts({ lot }: { readonly lot: DashboardLotDetails }) {
  const { text, language } = useLanguage();
  const degrees = (value: number | null) => (value === null ? MISSING : formatDegrees(value, language));
  return (
    <dl className="facts">
      <Fact label={text.lot.stateLabel}>
        <LotStateMark isOnline={lot.isOnline} />
      </Fact>
      <Fact label={text.createLot.addressLabel}>{lot.address}</Fact>
      <Fact label={text.createLot.latitudeLabel} numeric>{degrees(lot.latitude)}</Fact>
      <Fact label={text.createLot.longitudeLabel} numeric>{degrees(lot.longitude)}</Fact>
      <Fact label={text.createLot.capacityLabel} numeric>{formatCount(lot.capacity, language)}</Fact>
      <Fact label={text.lot.beaconMajorLabel} numeric>{lot.beaconMajor === null ? MISSING : String(lot.beaconMajor)}</Fact>
    </dl>
  );
}
