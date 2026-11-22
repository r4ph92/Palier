import type { DashboardStaleSession, LastProofKind } from '@palier/shared-types';
import { AppLink } from '../components/AppLink.tsx';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { formatRecentDateTime } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { interpolateKeepingValuesWhole } from '../i18n/interpolateKeepingValuesWhole.tsx';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { closesOnEscape } from '../lotMap/closesOnEscape.ts';
import { useFocusWhen } from '../lotMap/useFocusWhen.ts';
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
        {confirmation.question.askingId === session.id ? <CloseQuestion session={session} confirmation={confirmation} /> : <RowButtons session={session} confirmation={confirmation} />}
      </td>
    </tr>
  );
}

function SpotCell({ spot }: { readonly spot: DashboardStaleSession['spot'] }) {
  const { staleSessions: text } = useText();
  return (
    <td role="cell" className="check-place">
      <span className="figure no-break">{spot.number}</span> · {interpolateKeepingValuesWhole(text.place, { level: spot.levelCode, aisle: spot.aisleCode })}
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

function RowButtons({ session, confirmation }: Pick<RowProps, 'session' | 'confirmation'>) {
  return (
    <span className="row-actions">
      <PresenceButton session={session} confirmation={confirmation} />
      <CloseButton session={session} confirmation={confirmation} />
      <PresenceOutcome session={session} confirmation={confirmation} />
    </span>
  );
}

function PresenceButton({ session, confirmation }: Pick<RowProps, 'session' | 'confirmation'>) {
  const { staleSessions: text } = useText();
  const refused = rowRefusalOf(session, confirmation);
  return (
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
  );
}

// The closing cannot be undone, so the button only opens a question on its row.
function CloseButton({ session, confirmation }: Pick<RowProps, 'session' | 'confirmation'>) {
  const { staleSessions: text } = useText();
  const closeRef = useFocusWhen<HTMLButtonElement>(confirmation.question.cancelledId === session.id);
  const busy = confirmation.confirmingId !== null;
  return (
    <button
      type="button"
      ref={closeRef}
      className="text-button"
      aria-label={interpolate(text.close.name, { plate: session.plate })}
      aria-disabled={busy}
      onClick={() => (busy ? undefined : confirmation.question.ask(session))}
    >
      {text.close.shown}
    </button>
  );
}

function CloseQuestion({ session, confirmation }: Pick<RowProps, 'session' | 'confirmation'>) {
  const { staleSessions: text } = useText();
  const confirmRef = useFocusWhen<HTMLButtonElement>(true);
  const closing = confirmation.confirmingId === session.id;
  return (
    <span className="row-actions delete-question" onKeyDown={(event) => closesOnEscape(event, confirmation.question.cancel)}>
      <span>{interpolateKeepingValuesWhole(text.closeQuestion, { plate: session.plate })}</span>
      <button type="button" ref={confirmRef} className="text-button" aria-label={interpolate(text.closeConfirm.name, { plate: session.plate })} aria-disabled={confirmation.confirmingId !== null} onClick={() => void confirmation.close(session)}>
        {closing ? text.closing.shown : text.closeConfirm.shown}
      </button>
      <button type="button" className="text-button" onClick={confirmation.question.cancel}>
        {text.closeCancel}
      </button>
    </span>
  );
}

// Beside the button: the busy word while its request runs, then the refusal if one came. The status line says the busy state to screen readers.
function PresenceOutcome({ session, confirmation }: Pick<RowProps, 'session' | 'confirmation'>) {
  const { staleSessions: text } = useText();
  if (confirmation.confirmingId === session.id) {
    return (
      <span className="muted check-busy-word" aria-hidden="true">
        {confirmation.action === 'CLOSE' ? text.closing.shown : text.confirming.shown}
      </span>
    );
  }
  const refused = rowRefusalOf(session, confirmation);
  return refused === null ? null : <ErrorNotice code={refused.code} id={presenceErrorId(session.id)} values={refused.values} takesFocus />;
}

function rowRefusalOf(session: DashboardStaleSession, confirmation: PresenceConfirmation): RowRefusal | null {
  return confirmation.refusal?.sessionId === session.id ? confirmation.refusal : null;
}
