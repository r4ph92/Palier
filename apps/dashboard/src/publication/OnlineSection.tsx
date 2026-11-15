import type { LotPublication } from '@palier/shared-types';
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

const NOTE_ID = 'online-note';

export function OnlineSection({ publication, missingNames, onSaved, onStale }: OnlineSectionProps) {
  const text = useText();
  const online = useOnlineChange({ lotId: publication.lotId, onSaved, onStale });
  return (
    <section className="section" aria-labelledby="online-title">
      <h2 id="online-title" className="section-title">
        {text.publication.stateTitle}
      </h2>
      <p>
        <LotStateMark isOnline={publication.isOnline} />
      </p>
      {publication.isOnline ? <GoOffline online={online} /> : <GoOnline online={online} missingNames={missingNames} />}
      {online.refusal === null ? null : <ErrorNotice key={online.refusal.attempt} code={online.refusal.code} takesFocus />}
    </section>
  );
}

// Disabled while something is missing; the note beside it names what, so the reason is never only the greyed button.
function GoOnline({ online, missingNames }: { readonly online: OnlineChange; readonly missingNames: string }) {
  const text = useText();
  const isReady = missingNames === '';
  return (
    <>
      <p id={NOTE_ID} className={isReady ? undefined : 'muted'}>
        {isReady ? text.publication.readyNote : interpolate(text.publication.missingNote, { names: missingNames })}
      </p>
      <button type="button" className="primary-button" disabled={!isReady} aria-disabled={online.busy} aria-describedby={NOTE_ID} onClick={() => void online.change(true)}>
        <StableLabel shown={online.busy ? text.publication.goingOnline : text.publication.goOnline} reserved={[text.publication.goOnline, text.publication.goingOnline]} />
      </button>
    </>
  );
}

function GoOffline({ online }: { readonly online: OnlineChange }) {
  const text = useText();
  return (
    <>
      <p id={NOTE_ID} className="lead">
        {text.publication.offlineNote}
      </p>
      <button type="button" className="secondary-button" aria-disabled={online.busy} aria-describedby={NOTE_ID} onClick={() => void online.change(false)}>
        <StableLabel shown={online.busy ? text.publication.goingOffline : text.publication.goOffline} reserved={[text.publication.goOffline, text.publication.goingOffline]} />
      </button>
    </>
  );
}
