import type { DashboardLotMap } from '@palier/shared-types';
import { useText } from '../i18n/LanguageContext.tsx';
import { AislesSection } from '../lotMap/AislesSection.tsx';
import { BeaconTable } from '../lotMap/BeaconTable.tsx';
import { LevelsSection } from '../lotMap/LevelsSection.tsx';
import { useLotMap } from '../lotMap/useLotMap.ts';
import { LotSubpageFailure, LotSubpageFrame, LotSubpageLoading, type LotSubpage } from './LotSubpage.tsx';

const LOADING_ROWS = 3;

export function MapPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const { resource, reload, isReloading, latest, show, refresh } = useLotMap(lotId);
  const page = { lotId, text: text.map, loadingRows: LOADING_ROWS };
  if (resource.status === 'loading') {
    return <LotSubpageLoading page={page} />;
  }
  if (resource.status === 'failed') {
    return <LotSubpageFailure page={page} failure={{ code: resource.error.code, onRetry: reload, isRetrying: isReloading }} />;
  }
  return <MapView page={page} map={latest ?? resource.value} onSaved={show} onStale={refresh} />;
}

interface MapViewProps {
  readonly page: LotSubpage;
  readonly map: DashboardLotMap;
  readonly onSaved: (map: DashboardLotMap) => void;
  readonly onStale: () => Promise<boolean>;
}

function MapView({ page, map, onSaved, onStale }: MapViewProps) {
  return (
    <LotSubpageFrame page={page} lotName={map.lotName}>
      <LevelsSection map={map} onSaved={onSaved} onStale={onStale} />
      <AislesSection map={map} onSaved={onSaved} />
      <BeaconTable map={map} onSaved={onSaved} />
    </LotSubpageFrame>
  );
}
