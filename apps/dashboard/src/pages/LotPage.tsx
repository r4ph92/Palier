import type { DashboardLot } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource } from '../api/useResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { LotStateMark } from '../components/LotStateMark.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { HOME_PATH } from '../navigation/routes.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

export function LotPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const lot = useResource(useCallback(() => dashboardClient.lot(lotId), [lotId])).resource;
  if (lot.status === 'loading') {
    return <p role="status" className="muted">{text.app.loading}</p>;
  }
  if (lot.status === 'failed') {
    return lot.error.code === 'LOT_NOT_FOUND' ? <NotFoundPage /> : <ErrorNotice code={lot.error.code} />;
  }
  return <LotDetails lot={lot.value} />;
}

function LotDetails({ lot }: { readonly lot: DashboardLot }) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={lot.name} />
      <p className="lead">
        <LotStateMark isOnline={lot.isOnline} />
      </p>
      <AppLink href={HOME_PATH} className="text-link">
        {text.lot.back}
      </AppLink>
    </>
  );
}
