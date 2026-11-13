import type { DashboardLotMap, DashboardMapLevel } from '@palier/shared-types';
import { ColumnHeads } from '../components/ColumnHeads.tsx';
import { Fact } from '../components/Fact.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { useAisleName } from './useAisleName.ts';

// Everything a technician types into the beacons' app: one UUID, the lot's major, then one minor per aisle.
export function BeaconTable({ map }: { readonly map: DashboardLotMap }) {
  const text = useText();
  return (
    <section className="section" aria-labelledby="beacons-title">
      <h2 id="beacons-title" className="section-title">
        {text.map.beaconsTitle}
      </h2>
      <p className="lead">{text.map.beaconsIntro}</p>
      <dl className="facts">
        <Fact label={text.map.platformUuidLabel} numeric>
          <code className="beacon-uuid">{map.platformUuid}</code>
        </Fact>
        <Fact label={text.map.majorLabel} numeric>
          {map.beaconMajor === null ? text.map.noMajor : String(map.beaconMajor)}
        </Fact>
      </dl>
      {map.levels.length === 0 ? <p className="muted">{text.map.noBeacons}</p> : <MinorTable map={map} />}
    </section>
  );
}

function MinorTable({ map }: { readonly map: DashboardLotMap }) {
  const text = useText();
  return (
    <table className="data-table">
      <ColumnHeads labels={[text.map.levelColumn, text.map.aisleColumn, text.map.minorColumn]} />
      <tbody>
        {map.levels.map((level) => (
          <LevelMinorRows key={level.id} level={level} />
        ))}
      </tbody>
    </table>
  );
}

function LevelMinorRows({ level }: { readonly level: DashboardMapLevel }) {
  const nameOf = useAisleName();
  return level.aisles.map((aisle) => (
    <tr key={aisle.id}>
      <td>{level.code}</td>
      <th scope="row">{nameOf(aisle)}</th>
      <td className="number-cell">{String(aisle.beaconMinor)}</td>
    </tr>
  ));
}
