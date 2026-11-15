import type { CreatedGate, DashboardLotGates } from '@palier/shared-types';
import { useState } from 'react';
import { useText } from '../i18n/LanguageContext.tsx';
import { AddGateForm } from '../gates/AddGateForm.tsx';
import { DeviceKeyPanel } from '../gates/DeviceKeyPanel.tsx';
import { GATE_LIST_TITLE_ID, GateList } from '../gates/GateList.tsx';
import { gateStaleData, type GateNotice, type ShownNotice } from '../gates/gateNotice.ts';
import type { ShownKey } from '../gates/useGateSecrets.ts';
import { useLotGates } from '../gates/useLotGates.ts';
import { useFocusAfterRender } from '../lotMap/useFocusAfterRender.ts';
import { LotSubpageFailure, LotSubpageFrame, LotSubpageLoading, type LotSubpage } from './LotSubpage.tsx';

const LOADING_ROWS = 3;

export function GatesPage({ lotId }: { readonly lotId: string }) {
  const text = useText();
  const { resource, reload, isReloading, latest, show, refresh } = useLotGates(lotId);
  const page = { lotId, text: text.gates, loadingRows: LOADING_ROWS };
  if (resource.status === 'loading') {
    return <LotSubpageLoading page={page} />;
  }
  if (resource.status === 'failed') {
    return <LotSubpageFailure page={page} failure={{ code: resource.error.code, onRetry: reload, isRetrying: isReloading }} />;
  }
  return <GatesView page={page} lotGates={latest ?? resource.value} onSaved={show} onStale={refresh} />;
}

interface GatesViewProps {
  readonly page: LotSubpage;
  readonly lotGates: DashboardLotGates;
  readonly onSaved: (lotGates: DashboardLotGates) => void;
  readonly onStale: () => Promise<boolean>;
}

// The one-time key stays above the list, even after the list is read again, until the operator dismisses it or leaves.
function GatesView({ page, lotGates, onSaved, onStale }: GatesViewProps) {
  const text = useText();
  const { shownKey, dismissKey, onAdded, context } = useGatesView({ lotGates, onSaved, onStale });
  return (
    <LotSubpageFrame page={page} lotName={lotGates.lotName}>
      <p className="lead">{text.gates.intro}</p>
      {shownKey === null ? null : <DeviceKeyPanel key={shownKey.deviceKey} shownKey={shownKey} onDismiss={dismissKey} />}
      <GateList lotGates={lotGates} notice={context.notice} context={context} />
      <AddGateForm lotId={lotGates.lotId} onAdded={onAdded} />
    </LotSubpageFrame>
  );
}

function useGatesView({ lotGates, onSaved, onStale }: Omit<GatesViewProps, 'page'>) {
  const [shownKey, setShownKey] = useState<ShownKey | null>(null);
  const notices = useGateNotices();
  const focusAfterRender = useFocusAfterRender();
  const onAdded = (created: CreatedGate, gateName: string) => {
    showListAfterAdd(created, { onSaved, onStale });
    setShownKey({ gateId: created.gateId, deviceKey: created.deviceKey, gateName });
  };
  const dismissKey = () => {
    setShownKey(null);
    focusAfterRender(GATE_LIST_TITLE_ID);
  };
  const context = { lotId: lotGates.lotId, lotName: lotGates.lotName, onSaved, onKey: setShownKey, onNotice: notices.show, staleData: gateStaleData(onStale), notice: notices };
  return { shownKey, dismissKey, onAdded, context };
}

// The API answers the key even when it could not read the list again: the page reads it itself.
function showListAfterAdd({ lotGates }: CreatedGate, { onSaved, onStale }: Pick<GatesViewProps, 'onSaved' | 'onStale'>): void {
  if (lotGates === null) {
    void onStale();
    return;
  }
  onSaved(lotGates);
}

// Each notice gets its own key, so the same refusal twice takes focus twice.
function useGateNotices(): ShownNotice & { readonly show: (notice: GateNotice) => void } {
  const [shown, setShown] = useState<ShownNotice>({ notice: null, key: 0 });
  const show = (notice: GateNotice) => setShown((previous) => ({ notice, key: previous.key + 1 }));
  return { ...shown, show };
}
