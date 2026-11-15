import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import type { GateChange, GateNotice } from './gateNotice.ts';
import { useGateLimitValues } from './useGateLimitValues.ts';

// A refusal takes focus under the list's title, so a keyboard user continues from it.
export function GateRefusalLine({ notice }: { readonly notice: GateNotice | null }) {
  const limits = useGateLimitValues();
  if (notice?.kind !== 'refused') {
    return null;
  }
  return <ErrorNotice code={notice.refusal.code} values={{ ...limits, ...notice.refusal.values }} takesFocus />;
}

interface GateChangeLineProps {
  readonly change: GateChange | null;
  // Changes with each notice, so the same sentence twice is announced twice.
  readonly changeKey: number;
}

// Always on the page, so a screen reader announces the sentence the moment it appears under the row's actions.
export function GateChangeLine({ change, changeKey }: GateChangeLineProps) {
  const { gates: text } = useText();
  return (
    <p role="status" className="gate-notice">
      {change === null ? null : <StateMark key={changeKey} tone="free" label={interpolate(text[change.kind], { gate: change.gateName })} wraps />}
    </p>
  );
}
