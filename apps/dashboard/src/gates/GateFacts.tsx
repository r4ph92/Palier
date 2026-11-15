import type { DashboardGate } from '@palier/shared-types';
import { Fact } from '../components/Fact.tsx';
import { useText } from '../i18n/LanguageContext.tsx';

export function GateFacts({ gate }: { readonly gate: DashboardGate }) {
  const text = useText();
  const gates = text.gates;
  return (
    <dl className="facts gate-facts">
      <Fact label={gates.kindLabel}>{text.equipment.kinds[gate.kind]}</Fact>
      <Fact label={gates.integrationLabel}>{gates.integrations[gate.integrationKind]}</Fact>
      <Fact label={gates.endpointLabel}>{gate.endpoint === null ? gates.noEndpoint : <span className="gate-endpoint">{gate.endpoint}</span>}</Fact>
      <Fact label={gates.loopsLabel}>{gate.reportsLoops ? gates.loopsReported : gates.loopsNotReported}</Fact>
      {gate.kind === 'EXIT' ? <Fact label={gates.exitIdentificationLabel}>{gates.exitIdentifications[gate.exitIdentification]}</Fact> : null}
    </dl>
  );
}
