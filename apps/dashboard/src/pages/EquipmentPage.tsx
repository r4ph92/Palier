import type { DashboardLotEquipment } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { usePolledLotResource } from '../api/usePolledLotResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { GatesSection } from '../equipment/GatesSection.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { mapPath } from '../navigation/routes.ts';
import { PolledLotSubpage } from './LotSubpage.tsx';

const LOADING_ROWS = 2;

export function EquipmentPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const equipment = usePolledLotResource(useCallback(() => dashboardClient.lotEquipment(lotId), [lotId]));
  return (
    <PolledLotSubpage page={{ lotId, text: text.equipment, loadingRows: LOADING_ROWS }} resource={equipment}>
      {(value) => <EquipmentView equipment={value} />}
    </PolledLotSubpage>
  );
}

function EquipmentView({ equipment }: { readonly equipment: DashboardLotEquipment }) {
  const text = useText();
  return (
    <>
      <GatesSection equipment={equipment} />
      <p className="lead">
        {text.equipment.batteriesNote}{' '}
        <AppLink href={mapPath(equipment.lotId)} className="text-link">
          {text.equipment.batteriesLink}
        </AppLink>
      </p>
    </>
  );
}
