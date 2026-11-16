import type { DashboardSessionRow } from '@palier/shared-types';
import { formatMoney } from '@palier/shared-types/money';
import { useEffect, useRef, type RefObject } from 'react';
import { AppLink } from '../components/AppLink.tsx';
import { formatRecentDateTime } from '../i18n/formatNumbers.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { sessionPath } from '../navigation/routes.ts';
import { MissingFigure } from './missing.tsx';
import { SessionStateMark } from './SessionStateMark.tsx';

interface SessionsTableProps {
  readonly lotId: string;
  readonly sessions: readonly DashboardSessionRow[];
  readonly isBusy: boolean;
  readonly focusedSessionId: string | null;
}

// Explicit roles keep the table a table for screen readers when narrow screens stack each row.
export function SessionsTable({ lotId, sessions, isBusy, focusedSessionId }: SessionsTableProps) {
  const { sessions: text } = useLanguage().text;
  const focusedLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => focusedLink.current?.focus(), [focusedSessionId]);
  return (
    <div className="session-table-box" aria-busy={isBusy}>
      <table className="data-table stacked-table session-table" role="table">
        <caption className="visually-hidden">{text.tableCaption}</caption>
        <SessionsHead />
        <tbody role="rowgroup">
          {sessions.map((session) => (
            <SessionRow key={session.id} lotId={lotId} session={session} linkRef={session.id === focusedSessionId ? focusedLink : undefined} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionsHead() {
  const { columns } = useText().sessions;
  return (
    <thead role="rowgroup">
      <tr role="row">
        {[columns.plate, columns.entry, columns.state, columns.spot, columns.amount].map((label) => (
          <th key={label} scope="col" role="columnheader">
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

interface SessionRowProps {
  readonly lotId: string;
  readonly session: DashboardSessionRow;
  readonly linkRef: RefObject<HTMLAnchorElement | null> | undefined;
}

function SessionRow({ lotId, session, linkRef }: SessionRowProps) {
  return (
    <tr role="row" className="session-row">
      <th scope="row" role="rowheader" className="session-plate">
        <AppLink href={sessionPath(lotId, session.id)} className="text-link" linkRef={linkRef}>
          {session.plate}
        </AppLink>
      </th>
      <EntryCell instant={session.entryAt} />
      <td role="cell" className="session-state">
        <SessionStateMark state={session.state} />
      </td>
      <td role="cell" className="session-spot number-cell">
        {session.assignedSpotNumber}
      </td>
      <AmountCell cents={session.amountCents} />
    </tr>
  );
}

function EntryCell({ instant }: { readonly instant: string }) {
  const { language } = useLanguage();
  return (
    <td role="cell" className="session-entry number-cell">
      <time dateTime={instant}>{formatRecentDateTime(new Date(instant), language, new Date())}</time>
    </td>
  );
}

function AmountCell({ cents }: { readonly cents: number | null }) {
  const { language } = useLanguage();
  return (
    <td role="cell" className="session-amount number-cell">
      {cents === null ? <MissingFigure /> : formatMoney(cents, language)}
    </td>
  );
}
