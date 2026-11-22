import type { EntrySessionState } from '@palier/shared-types';
import { StateMark, type StateTone } from '../components/StateMark.tsx';
import { useText } from '../i18n/LanguageContext.tsx';

// A vehicle inside reads as a favourable state, one left with its payment pending as something to watch, and an ended session as quiet.
const TONES: Readonly<Record<EntrySessionState, StateTone>> = {
  CREATED: 'free',
  ENTRY_CONFIRMED: 'free',
  PARKED_PRESUMED: 'free',
  PARKED_UNCONFIRMED: 'warning',
  PARKED_CONFIRMED: 'free',
  CANCELLED: 'muted',
  CLOSED_PAID: 'muted',
  CLOSED_CAPTURE_PENDING: 'warning',
  CLOSED_BY_STAFF: 'muted',
};

export function SessionStateMark({ state }: { readonly state: EntrySessionState }) {
  const { sessions } = useText();
  return <StateMark tone={TONES[state]} label={sessions.states[state]} />;
}
