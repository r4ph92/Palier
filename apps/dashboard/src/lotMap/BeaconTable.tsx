import type { DashboardLotMap, DashboardMapAisle, DashboardMapLevel } from '@palier/shared-types';
import { useState } from 'react';
import { ColumnHeads } from '../components/ColumnHeads.tsx';
import { Fact } from '../components/Fact.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { formatPercent } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { batteryMarkOf } from './batteryMark.ts';
import { RecordBatteryForm } from './RecordBatteryForm.tsx';
import { useAisleName } from './useAisleName.ts';
import { useMapLimitValues } from './useMapLimitValues.ts';

interface BeaconTableProps {
  readonly map: DashboardLotMap;
  readonly onSaved: (map: DashboardLotMap) => void;
}

interface RecordedBattery {
  readonly aisleName: string;
  readonly percent: number;
}

type RecordBattery = (map: DashboardLotMap, recorded: RecordedBattery) => void;

// Everything a technician types into the beacons' app, one UUID, the lot's major, then one minor per aisle, and what each battery read last.
export function BeaconTable({ map, onSaved }: BeaconTableProps) {
  const text = useText();
  const [recorded, setRecorded] = useState<RecordedBattery | null>(null);
  const record: RecordBattery = (saved, reading) => {
    setRecorded(reading);
    onSaved(saved);
  };
  return (
    <section className="section" aria-labelledby="beacons-title">
      <h2 id="beacons-title" className="section-title">
        {text.map.beaconsTitle}
      </h2>
      <p className="lead">{text.map.beaconsIntro}</p>
      <BeaconFacts map={map} />
      {map.levels.length === 0 ? <p className="muted">{text.map.noBeacons}</p> : <BatteryTable map={map} onRecorded={record} />}
      <RecordedNote recorded={recorded} />
    </section>
  );
}

function BeaconFacts({ map }: { readonly map: DashboardLotMap }) {
  const text = useText();
  return (
    <dl className="facts">
      <Fact label={text.map.platformUuidLabel} numeric>
        <code className="beacon-uuid">{map.platformUuid}</code>
      </Fact>
      <Fact label={text.map.majorLabel} numeric={map.beaconMajor !== null}>
        {map.beaconMajor === null ? <span className="muted">{text.map.noMajor}</span> : String(map.beaconMajor)}
      </Fact>
    </dl>
  );
}

function BatteryTable({ map, onRecorded }: { readonly map: DashboardLotMap; readonly onRecorded: RecordBattery }) {
  const text = useText();
  const limits = useMapLimitValues();
  const columns = [text.map.levelColumn, text.map.aisleColumn, text.map.minorColumn, text.map.batteryColumn, text.map.readingColumn];
  return (
    <>
      <p className="lead">{interpolate(text.map.batteryHelp, limits)}</p>
      <div className="wide-table-scroll">
        <table className="data-table">
          <ColumnHeads labels={columns} />
          <tbody>
            {map.levels.map((level) => (
              <LevelBeaconRows key={level.id} lotId={map.lotId} level={level} onRecorded={onRecorded} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface LevelBeaconRowsProps {
  readonly lotId: string;
  readonly level: DashboardMapLevel;
  readonly onRecorded: RecordBattery;
}

function LevelBeaconRows({ lotId, level, onRecorded }: LevelBeaconRowsProps) {
  return level.aisles.map((aisle) => <BeaconRow key={aisle.id} row={{ lotId, levelCode: level.code, aisle }} onRecorded={onRecorded} />);
}

interface BeaconRowData {
  readonly lotId: string;
  readonly levelCode: string;
  readonly aisle: DashboardMapAisle;
}

function BeaconRow({ row: { lotId, levelCode, aisle }, onRecorded }: { readonly row: BeaconRowData; readonly onRecorded: RecordBattery }) {
  const { text, language } = useLanguage();
  const aisleName = useAisleName()(aisle);
  const mark = batteryMarkOf(aisle, text.map, language);
  return (
    <tr>
      <td>{levelCode}</td>
      <th scope="row">{aisleName}</th>
      <td className="number-cell">{String(aisle.beaconMinor)}</td>
      <td>
        <StateMark tone={mark.tone} label={mark.label} />
      </td>
      <td>
        <RecordBatteryForm lotId={lotId} aisleId={aisle.id} aisleName={aisleName} onRecorded={(map, percent) => onRecorded(map, { aisleName, percent })} />
      </td>
    </tr>
  );
}

// Mounted with the table and empty until a reading is saved, so the confirmation is announced.
function RecordedNote({ recorded }: { readonly recorded: RecordedBattery | null }) {
  const { text, language } = useLanguage();
  return (
    <p role="status">
      {recorded === null ? null : interpolate(text.map.batteryRecorded, { aisle: recorded.aisleName, percent: formatPercent(recorded.percent, language) })}
    </p>
  );
}
