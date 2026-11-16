import type { DashboardStaleSessions } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource } from '../api/useResource.ts';
import { AppLink } from '../components/AppLink.tsx';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure, type RetryableFailureProps } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { pluralOf } from '../i18n/plural.ts';
import { lotPath } from '../navigation/routes.ts';
import { PRESENCE_STATUS_ID } from '../staleSessions/staleSessionIds.ts';
import { StaleSessionsTable } from '../staleSessions/StaleSessionsTable.tsx';
import { usePresenceConfirmation, type PresenceConfirmation } from '../staleSessions/usePresenceConfirmation.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

const LOADING_ROWS = 3;
const COUNT_ID = 'stale-sessions-count';

export function StaleSessionsPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const { resource, reload, isReloading } = useResource(useCallback(() => dashboardClient.staleSessions(lotId), [lotId]));
  if (resource.status === 'loading') {
    return (
      <>
        <PageHeader eyebrow={text.lot.eyebrow} title={text.staleSessions.title} />
        <SkeletonRows count={LOADING_ROWS} label={text.app.loading} />
      </>
    );
  }
  if (resource.status === 'failed') {
    return resource.error.code === 'LOT_NOT_FOUND' ? <NotFoundPage /> : <StaleSessionsUnavailable lotId={lotId} code={resource.error.code} onRetry={reload} isRetrying={isReloading} />;
  }
  return <StaleSessionsView lotId={lotId} initial={resource.value} />;
}

function StaleSessionsUnavailable({ lotId, ...failure }: RetryableFailureProps & { readonly lotId: string }) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={text.staleSessions.title} />
      <div className="actions-row">
        <RetryableFailure {...failure} />
        <BackLink lotId={lotId} />
      </div>
    </>
  );
}

function StaleSessionsView({ lotId, initial }: { readonly lotId: string; readonly initial: DashboardStaleSessions }) {
  const { staleSessions: text, lot } = useText();
  const confirmation = usePresenceConfirmation(lotId, initial);
  return (
    <>
      <PageHeader eyebrow={lot.eyebrow} title={interpolate(text.titleInLot, { lot: initial.lotName })} />
      {confirmation.listRefusal === null ? null : <ErrorNotice code={confirmation.listRefusal.code} values={confirmation.listRefusal.values} takesFocus />}
      <ConfirmationStatusLine status={confirmation} />
      {confirmation.sessions.length === 0 ? <EmptyList /> : <FlaggedSessions lotId={lotId} confirmation={confirmation} />}
      <BackLink lotId={lotId} />
    </>
  );
}

function FlaggedSessions({ lotId, confirmation }: { readonly lotId: string; readonly confirmation: PresenceConfirmation }) {
  const { text, language } = useLanguage();
  return (
    <>
      <p id={COUNT_ID} className="number-cell">
        {pluralOf(text.staleSessions.count, confirmation.sessions.length, language)}
      </p>
      <p className="muted">{text.staleSessions.hint}</p>
      <StaleSessionsTable lotId={lotId} confirmation={confirmation} labelledBy={COUNT_ID} />
    </>
  );
}

// The line takes focus when the last session is confirmed, since the button that had it is gone.
type StatusProps = { readonly status: Pick<PresenceConfirmation, 'confirmingPlate' | 'confirmedPlate'> };

function ConfirmationStatusLine({ status }: StatusProps) {
  return (
    <p role="status" id={PRESENCE_STATUS_ID} tabIndex={-1} className="check-status">
      <ConfirmationStatusText status={status} />
    </p>
  );
}

function ConfirmationStatusText({ status: { confirmingPlate, confirmedPlate } }: StatusProps) {
  const { staleSessions: text } = useText();
  if (confirmingPlate !== null) {
    return <span className="muted">{interpolate(text.confirming.status, { plate: confirmingPlate })}</span>;
  }
  return confirmedPlate === null ? null : <StateMark tone="free" label={interpolate(text.confirmed, { plate: confirmedPlate })} />;
}

function EmptyList() {
  const { staleSessions: text } = useText();
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
      {text.staleSessions.back}
    </AppLink>
  );
}
