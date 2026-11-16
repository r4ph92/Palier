import type { DashboardSessionDetail } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { isSessionGone, usePolledSession } from '../api/usePolledSession.ts';
import { AppLink } from '../components/AppLink.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RetryableFailure, type RetryableFailureProps } from '../components/RetryableFailure.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { StaleNote } from '../components/StaleNote.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { sessionsPath } from '../navigation/routes.ts';
import { SessionSummary } from '../sessions/SessionSummary.tsx';
import { TimelineList } from '../sessions/TimelineList.tsx';
import { NotFoundPage } from './NotFoundPage.tsx';

const LOADING_ROWS = 4;

interface SessionPageProps {
  readonly lotId: string;
  readonly sessionId: string;
}

export function SessionPage({ lotId, sessionId }: SessionPageProps) {
  const detail = usePolledSession(useCallback(() => dashboardClient.session(lotId, sessionId), [lotId, sessionId]));
  if (detail.status === 'loading') {
    return <SessionLoading />;
  }
  if (detail.status === 'failed') {
    return isSessionGone(detail.error) ? <NotFoundPage /> : <SessionUnavailable lotId={lotId} failure={{ code: detail.error.code, onRetry: detail.retry, isRetrying: detail.isRetrying }} />;
  }
  return (
    <>
      <StaleNote isStale={detail.isStale} updatedAt={detail.updatedAt} />
      <SessionView lotId={lotId} detail={detail.value} />
    </>
  );
}

function SessionLoading() {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.lot.eyebrow} title={interpolate(text.sessions.session.title, { plate: '…' })} />
      <SkeletonRows count={LOADING_ROWS} label={text.app.loading} />
    </>
  );
}

function SessionUnavailable({ lotId, failure }: { readonly lotId: string; readonly failure: RetryableFailureProps }) {
  const { lot, sessions } = useText();
  return (
    <>
      <PageHeader eyebrow={lot.eyebrow} title={sessions.session.unavailableTitle} />
      <div className="actions-row">
        <RetryableFailure {...failure} />
        <BackToSessions lotId={lotId} />
      </div>
    </>
  );
}

function SessionView({ lotId, detail }: { readonly lotId: string; readonly detail: DashboardSessionDetail }) {
  const { sessions } = useText();
  return (
    <>
      <PageHeader eyebrow={detail.lotName} title={interpolate(sessions.session.title, { plate: detail.summary.plate })} />
      <section className="section" aria-labelledby="session-summary-title">
        <h2 id="session-summary-title" className="section-title">
          {sessions.session.summaryTitle}
        </h2>
        <SessionSummary summary={detail.summary} />
      </section>
      <TimelineSection detail={detail} />
      <BackToSessions lotId={lotId} />
    </>
  );
}

function TimelineSection({ detail }: { readonly detail: DashboardSessionDetail }) {
  const { sessions } = useText();
  return (
    <section className="section" aria-labelledby="session-timeline-title">
      <h2 id="session-timeline-title" className="section-title">
        {sessions.session.timelineTitle}
      </h2>
      {detail.timeline.length === 0 ? <p className="muted">{sessions.session.timelineEmpty}</p> : <TimelineList timeline={detail.timeline} />}
    </section>
  );
}

function BackToSessions({ lotId }: { readonly lotId: string }) {
  const { sessions } = useText();
  return (
    <AppLink href={sessionsPath(lotId)} className="text-link">
      {sessions.session.back}
    </AppLink>
  );
}
