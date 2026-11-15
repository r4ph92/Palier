import type { SessionListStatus } from '@palier/shared-types/sessionTimeline';
import { useState } from 'react';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { SkeletonRows } from '../components/SkeletonRows.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { SessionsTable } from '../sessions/SessionsTable.tsx';
import { StatusFilter } from '../sessions/StatusFilter.tsx';
import { useSessionList, type OlderSessions, type SessionListState } from '../sessions/useSessionList.ts';
import { LotSubpageFailure, LotSubpageFrame, LotSubpageLoading, type LotSubpage } from './LotSubpage.tsx';

const LOADING_ROWS = 3;

type ReadyList = Extract<SessionListState, { kind: 'ready' }>;

export function SessionsPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const [status, setStatus] = useState<SessionListStatus>('OPEN');
  const list = useSessionList(lotId, status);
  const page: LotSubpage = { lotId, text: text.sessions, loadingRows: LOADING_ROWS };
  if (list.kind === 'loading') {
    return <LotSubpageLoading page={page} />;
  }
  if (list.kind === 'failed') {
    return <LotSubpageFailure page={page} failure={{ code: list.error.code, onRetry: list.retry, isRetrying: list.isRetrying }} />;
  }
  return (
    <LotSubpageFrame page={page} lotName={list.lotName}>
      <StatusFilter status={status} onChange={setStatus} />
      <SessionsBody lotId={lotId} status={status} list={list} />
    </LotSubpageFrame>
  );
}

interface SessionsBodyProps {
  readonly lotId: string;
  readonly status: SessionListStatus;
  readonly list: ReadyList;
}

function SessionsBody({ lotId, status, list }: SessionsBodyProps) {
  const text = useText();
  if (list.isSwitching) {
    return <SkeletonRows count={LOADING_ROWS} label={text.app.loading} />;
  }
  if (list.sessions.length === 0) {
    return <EmptyList status={status} />;
  }
  return (
    <>
      <SessionsTable lotId={lotId} sessions={list.sessions} />
      <OlderButton older={list.older} />
    </>
  );
}

function EmptyList({ status }: { readonly status: SessionListStatus }) {
  const { sessions } = useText();
  return (
    <>
      <p>{status === 'OPEN' ? sessions.emptyOpen : sessions.emptyAll}</p>
      <p className="muted">{sessions.emptyHint}</p>
    </>
  );
}

function OlderButton({ older }: { readonly older: OlderSessions }) {
  const { sessions } = useText();
  return (
    <div className="older-sessions">
      {older.failure === null ? null : <ErrorNotice code={older.failure} />}
      {older.hasMore ? (
        <button type="button" className="text-button" aria-disabled={older.isLoading} onClick={older.load}>
          {older.isLoading ? sessions.older.busy : sessions.older.shown}
        </button>
      ) : null}
    </div>
  );
}
