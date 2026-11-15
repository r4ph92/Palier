import { useState } from 'react';
import { StateMark } from '../components/StateMark.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { useFocusWhen } from '../lotMap/useFocusWhen.ts';
import type { ShownKey } from './useGateSecrets.ts';

type CopyState = 'idle' | 'copied' | 'failed';

interface DeviceKeyPanelProps {
  readonly shownKey: ShownKey;
  readonly onDismiss: () => void;
}

// The only time the key is on screen: page state, gone once dismissed or when the operator leaves the page.
export function DeviceKeyPanel({ shownKey, onDismiss }: DeviceKeyPanelProps) {
  const { gates: text } = useText();
  const titleRef = useFocusWhen<HTMLHeadingElement>(true);
  return (
    <section className="key-panel" aria-labelledby="device-key-title">
      <h2 id="device-key-title" ref={titleRef} tabIndex={-1} className="section-title">
        {interpolate(text.keyTitle, { gate: shownKey.gateName })}
      </h2>
      <p className="key-warning">{text.keyWarning}</p>
      <code className="device-key">{shownKey.deviceKey}</code>
      <p className="field-hint">{text.keyUse}</p>
      <KeyActions deviceKey={shownKey.deviceKey} onDismiss={onDismiss} />
    </section>
  );
}

function KeyActions({ deviceKey, onDismiss }: { readonly deviceKey: string; readonly onDismiss: () => void }) {
  const { gates: text } = useText();
  const { state, copy } = useKeyCopy(deviceKey);
  return (
    <>
      <div className="actions-row">
        <button type="button" className="secondary-button" onClick={() => void copy()}>
          {text.copyKey}
        </button>
        <button type="button" className="text-button" onClick={onDismiss}>
          {text.dismissKey}
        </button>
      </div>
      <p role="status" className="key-copy-status">
        {state === 'idle' ? null : <StateMark tone={state === 'copied' ? 'free' : 'danger'} label={state === 'copied' ? text.keyCopied : text.copyFailed} wraps />}
      </p>
    </>
  );
}

function useKeyCopy(deviceKey: string) {
  const [state, setState] = useState<CopyState>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deviceKey);
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  return { state, copy };
}
