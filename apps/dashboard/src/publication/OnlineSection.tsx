import type { LotPublication } from '@palier/shared-types';
import type { MouseEvent } from 'react';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { LotStateMark } from '../components/LotStateMark.tsx';
import { StableLabel } from '../components/StableLabel.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { useOnlineChange, type OnlineChange, type OnlineChangeTarget } from './useOnlineChange.ts';

interface OnlineSectionProps extends Omit<OnlineChangeTarget, 'lotId'> {
  readonly publication: LotPublication;
  // Empty when nothing is missing.
  readonly missingNames: string;
}

interface OnlineButtonProps {
  readonly isOnline: boolean;
  readonly isReady: boolean;
  readonly online: OnlineChange;
}

const NOTE_ID = 'online-note';

export function OnlineSection({ publication, missingNames, onSaved, onStale }: OnlineSectionProps) {
  const text = useText();
  const online = useOnlineChange({ lotId: publication.lotId, onSaved, onStale });
  const { isOnline } = publication;
  return (
    <section className="section" aria-labelledby="online-title">
      <h2 id="online-title" className="section-title">
        {text.publication.stateTitle}
      </h2>
      <OnlineState isOnline={isOnline} />
      <OnlineNote publication={publication} missingNames={missingNames} />
      <OnlineButton isOnline={isOnline} isReady={publication.missing.length === 0} online={online} />
      {online.refusal === null ? null : <ErrorNotice key={online.refusal.attempt} code={online.refusal.code} takesFocus />}
    </section>
  );
}

// The mark shows the state; the status line says it again in a sentence, so each change is announced.
function OnlineState({ isOnline }: { readonly isOnline: boolean }) {
  const words = useText().publication;
  return (
    <>
      <p>
        <LotStateMark isOnline={isOnline} />
      </p>
      <p role="status" className="visually-hidden">
        {isOnline ? words.onlineStatus : words.offlineStatus}
      </p>
    </>
  );
}

// While something is missing the note names what, so the reason is never only the greyed button.
function OnlineNote({ publication, missingNames }: Pick<OnlineSectionProps, 'publication' | 'missingNames'>) {
  const words = useText().publication;
  if (publication.isOnline) {
    return <p id={NOTE_ID} className="lead">{words.offlineNote}</p>;
  }
  if (publication.missing.length === 0) {
    return <p id={NOTE_ID}>{words.readyNote}</p>;
  }
  return <p id={NOTE_ID} className="muted">{interpolate(words.missingNote, { names: missingNames })}</p>;
}

// One element for both directions: the operator's focus stays on it when the lot changes state.
function OnlineButton({ isOnline, isReady, online }: OnlineButtonProps) {
  const words = useText().publication;
  const [idle, busy] = isOnline ? [words.goOffline, words.goingOffline] : [words.goOnline, words.goingOnline];
  return (
    <button
      type="button"
      className={isOnline ? 'secondary-button' : 'primary-button'}
      disabled={!isOnline && !isReady}
      aria-disabled={online.busy}
      aria-describedby={NOTE_ID}
      onClick={(event) => toggle(event, { isOnline, online })}
    >
      <StableLabel shown={online.busy ? busy : idle} reserved={[words.goOnline, words.goingOnline, words.goOffline, words.goingOffline]} />
    </button>
  );
}

// The same button does the opposite once the lot has changed: a double-click's second click would undo the first.
function toggle(event: MouseEvent<HTMLButtonElement>, { isOnline, online }: Omit<OnlineButtonProps, 'isReady'>): void {
  if (event.detail > 1) {
    return;
  }
  void online.change(!isOnline);
}
