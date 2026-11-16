import type { DashboardStaleSession, LastProofKind } from '@palier/shared-types';
import { AppLink } from '../components/AppLink.tsx';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { formatRecentDateTime } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { sessionPath } from '../navigation/routes.ts';
import { presenceButtonId, presenceErrorId } from './staleSessionIds.ts';
import type { PresenceConfirmation, RowRefusal } from './usePresenceConfirmation.ts';

interface StaleSessionsTableProps {
  readonly lotId: string;
  readonly confirmation: PresenceConfirmation;
  readonly labelledBy: string;
}

type RowProps = Pick<StaleSessionsTableProps, 'lotId' | 'confirmation'> & { readonly session: DashboardStaleSession };

// Explicit roles keep the table a table for screen readers when narrow screens stack each row. The rows share the layout of the spots to check (spotsToCheck.css).
export function StaleSessionsTable({ lotId, confirmation, labelledBy }: StaleSessionsTableProps) {
  return (
    <div className="check-table-box">
      <table className="data-table stacked-table check-table" role="table" aria-labelledby={labelledBy}>
        <StaleSessionsHead />
        <tbody role="rowgroup">
          {confirmation.sessions.map((session) => (
            <StaleSessionRow key={session.id} lotId={lotId} session={session} confirmation={confirmation} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaleSessionsHead() {
  const { staleSessions: text } = useText();
  return (
    <thead role="rowgroup">
      <tr role="row">
        {[text.columns.plate, text.columns.spot, text.columns.lastProof, text.columns.flagged].map((label) => (
          <th key={label} scope="col" role="columnheader">
            {label}
          </th>
        ))}
        <th scope="col" role="columnheader">
          <span className="visually-hidden">{text.columns.check}</span>
        </th>
      </tr>
    </thead>
  );
}

function StaleSessionRow({ lotId, session, confirmation }: RowProps) {
  return (
    <tr role="row" className="check-row" aria-busy={confirmation.confirmingId === session.id}>
      <th scope="row" role="rowheader" className="check-number number-cell">
        <AppLink href={sessionPath(lotId, session.id)} className="text-link">
          {session.plate}
        </AppLink>
      </th>
      <SpotCell spot={session.spot} />
      <LastProofCell session={session} />
      <InstantCell instant={session.flaggedAt} />
      <td role="cell" className="check-action">
        <PresenceButton session={session} confirmation={confirmation} />
      </td>
    </tr>
  );
}

function SpotCell({ spot }: { readonly spot: DashboardStaleSession['spot'] }) {
  const { staleSessions: text } = useText();
  return (
    <td role="cell" className="check-place">
      <span className="figure">{spot.number}</span> · {interpolate(text.place, { level: spot.levelCode, aisle: spot.aisleCode })}
    </td>
  );
}

function LastProofCell({ session }: { readonly session: DashboardStaleSession }) {
  const { staleSessions: text } = useText();
  const kind: LastProofKind = session.lastProofKind;
  return (
    <td role="cell" className="check-reason">
      {text.proofs[kind]} · <InstantText instant={session.lastProofAt} />
    </td>
  );
}

function InstantCell({ instant }: { readonly instant: string }) {
  return (
    <td role="cell" className="check-since number-cell">
      <InstantText instant={instant} />
    </td>
  );
}

function InstantText({ instant }: { readonly instant: string }) {
  const { language } = useLanguage();
  return <time dateTime={instant}>{formatRecentDateTime(new Date(instant), language, new Date())}</time>;
}

function PresenceButton({ session, confirmation }: Pick<RowProps, 'session' | 'confirmation'>) {
  const { staleSessions: text } = useText();
  const refused = rowRefusalOf(session, confirmation);
  return (
    <span className="row-actions">
      <button
        type="button"
        id={presenceButtonId(session.id)}
        className="text-button"
        aria-label={interpolate(text.present.name, { plate: session.plate })}
        aria-describedby={refused === null ? undefined : presenceErrorId(session.id)}
        aria-disabled={confirmation.confirmingId !== null}
        onClick={() => void confirmation.confirm(session)}
      >
        {text.present.shown}
      </button>
      <PresenceOutcome session={session} confirmation={confirmation} />
    </span>
  );
}

// Beside the button: the busy word while its request runs, then the refusal if one came. The status line says the busy state to screen readers.
function PresenceOutcome({ session, confirmation }: Pick<RowProps, 'session' | 'confirmation'>) {
  const { staleSessions: text } = useText();
  if (confirmation.confirmingId === session.id) {
    return (
      <span className="muted check-busy-word" aria-hidden="true">
        {text.confirming.shown}
      </span>
    );
  }
  const refused = rowRefusalOf(session, confirmation);
  return refused === null ? null : <ErrorNotice code={refused.code} id={presenceErrorId(session.id)} values={refused.values} takesFocus />;
}

function rowRefusalOf(session: DashboardStaleSession, confirmation: PresenceConfirmation): RowRefusal | null {
  return confirmation.refusal?.sessionId === session.id ? confirmation.refusal : null;
}
