import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import type { GateNotice } from './gateNotice.ts';
import { useGateLimitValues } from './useGateLimitValues.ts';

// A change is announced politely under the list's title; a refusal takes focus, so a keyboard user continues from it.
export function GateNoticeLine({ notice }: { readonly notice: GateNotice | null }) {
  const { gates: text } = useText();
  const limits = useGateLimitValues();
  const sentence = notice === null || notice.kind === 'refused' ? null : interpolate(text[notice.kind], { gate: notice.gateName });
  return (
    <>
      {notice?.kind === 'refused' ? <ErrorNotice code={notice.refusal.code} values={{ ...limits, ...notice.refusal.values }} takesFocus /> : null}
      <p role="status" className="gate-notice">
        {sentence === null ? null : <StateMark tone="free" label={sentence} wraps />}
      </p>
    </>
  );
}
