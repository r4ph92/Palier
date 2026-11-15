import type { DashboardSessionSummary } from '@palier/shared-types';
import { formatMoney } from '@palier/shared-types/money';
import type { ReactNode } from 'react';
import { Fact } from '../components/Fact.tsx';
import { formatRecentDateTime } from '../i18n/formatNumbers.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { SessionStateMark } from './SessionStateMark.tsx';

const MISSING = '—';

function Moment({ instant }: { readonly instant: string | null }) {
  const { language } = useLanguage();
  return instant === null ? MISSING : <time dateTime={instant}>{formatRecentDateTime(new Date(instant), language, new Date())}</time>;
}

export function SessionSummary({ summary }: { readonly summary: DashboardSessionSummary }) {
  const { session } = useText().sessions;
  return (
    <dl className="facts">
      <Fact label={session.plate}>{summary.plate}</Fact>
      <Fact label={session.state}>
        <SessionStateMark state={summary.state} />
      </Fact>
      <SpotFacts summary={summary} />
      <ProofFacts summary={summary} />
      <PaymentFacts summary={summary} />
      <Fact label={session.entry} numeric><Moment instant={summary.entryAt} /></Fact>
      <Fact label={session.exit} numeric><Moment instant={summary.exitAt} /></Fact>
    </dl>
  );
}

function SpotFacts({ summary }: { readonly summary: DashboardSessionSummary }) {
  const { session } = useText().sessions;
  return (
    <>
      <Fact label={session.assignedSpot} numeric>{summary.assignedSpotNumber}</Fact>
      <Fact label={session.realSpot} numeric>{summary.realSpotNumber ?? MISSING}</Fact>
    </>
  );
}

function ProofFacts({ summary }: { readonly summary: DashboardSessionSummary }) {
  const { session } = useText().sessions;
  return (
    <>
      <Fact label={session.evidence}>{summary.parkingEvidence === null ? MISSING : session.evidences[summary.parkingEvidence]}</Fact>
      <Fact label={session.exitMethod}>{summary.exitMethod === null ? MISSING : session.exitMethods[summary.exitMethod]}</Fact>
    </>
  );
}

function PaymentFacts({ summary }: { readonly summary: DashboardSessionSummary }) {
  const { text, language } = useLanguage();
  const money = (cents: number | null): ReactNode => (cents === null ? MISSING : formatMoney(cents, language));
  return (
    <>
      <Fact label={text.sessions.session.amount} numeric>{money(summary.amountCents)}</Fact>
      {summary.unpaidCents > 0 ? <Fact label={text.sessions.session.unpaid} numeric>{money(summary.unpaidCents)}</Fact> : null}
    </>
  );
}
