import type { DashboardLotGates } from '@palier/shared-types';
import { useText } from '../i18n/LanguageContext.tsx';
import { GateItem, type GateItemContext } from './GateItem.tsx';
import type { ShownNotice } from './gateNotice.ts';
import { GateNoticeLine } from './GateNoticeLine.tsx';

interface GateListProps {
  readonly lotGates: DashboardLotGates;
  readonly notice: ShownNotice;
  readonly context: GateItemContext;
}

export const GATE_LIST_TITLE_ID = 'gate-list-title';

export function GateList({ lotGates, notice, context }: GateListProps) {
  const { gates: text } = useText();
  return (
    <section className="section" aria-labelledby={GATE_LIST_TITLE_ID}>
      <h2 id={GATE_LIST_TITLE_ID} tabIndex={-1} className="section-title">
        {text.listTitle}
      </h2>
      <GateNoticeLine key={notice.key} notice={notice.notice} />
      {lotGates.gates.length === 0 ? (
        <p className="muted">{text.empty}</p>
      ) : (
        <ul className="row-list gate-list">
          {lotGates.gates.map((gate) => (
            <GateItem key={gate.id} gate={gate} context={context} />
          ))}
        </ul>
      )}
    </section>
  );
}
