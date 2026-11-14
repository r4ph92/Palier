import type { DashboardGateHealth, DashboardLotEquipment } from '@palier/shared-types';
import { SILENT_GATE_AFTER_MINUTES } from '@palier/shared-types/gates';
import { ColumnHeads } from '../components/ColumnHeads.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { gateHealthMarkOf } from './gateHealthMark.ts';

export function GatesSection({ equipment }: { readonly equipment: DashboardLotEquipment }) {
  const { text, language } = useLanguage();
  return (
    <section className="section" aria-labelledby="gates-title">
      <h2 id="gates-title" className="section-title">
        {text.equipment.gatesTitle}
      </h2>
      <p className="lead">{interpolate(text.equipment.gatesIntro, { minutes: formatCount(SILENT_GATE_AFTER_MINUTES, language) })}</p>
      {equipment.gates.length === 0 ? <p className="muted">{text.equipment.noGates}</p> : <GateTable equipment={equipment} />}
    </section>
  );
}

function GateTable({ equipment }: { readonly equipment: DashboardLotEquipment }) {
  const text = useText();
  const now = new Date(equipment.now);
  return (
    <table className="data-table">
      <ColumnHeads labels={[text.equipment.nameColumn, text.equipment.kindColumn, text.equipment.stateColumn]} />
      <tbody>
        {equipment.gates.map((gate) => (
          <GateRow key={gate.id} gate={gate} now={now} />
        ))}
      </tbody>
    </table>
  );
}

function GateRow({ gate, now }: { readonly gate: DashboardGateHealth; readonly now: Date }) {
  const { text, language } = useLanguage();
  const mark = gateHealthMarkOf(gate, { text: text.equipment, language, now });
  return (
    <tr>
      <th scope="row">{gate.name}</th>
      <td>{text.equipment.kinds[gate.kind]}</td>
      <td>
        <StateMark tone={mark.tone} label={mark.label} wraps />
      </td>
    </tr>
  );
}
