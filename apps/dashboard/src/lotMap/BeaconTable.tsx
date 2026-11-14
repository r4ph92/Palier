import type { DashboardLotMap, DashboardMapAisle, DashboardMapLevel } from '@palier/shared-types';
import { useState } from 'react';
import { ColumnHeads } from '../components/ColumnHeads.tsx';
import { Fact } from '../components/Fact.tsx';
import { FiguresInText } from '../components/FiguresInText.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { formatPercent } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { batteryMarkOf } from './batteryMark.ts';
import { RecordBatteryForm } from './RecordBatteryForm.tsx';
import { useAisleName } from './useAisleName.ts';
import { useBatteryLimitValues } from './useBatteryLimitValues.ts';

interface BeaconTableProps {
  readonly map: DashboardLotMap;
  readonly onSaved: (map: DashboardLotMap) => void;
  readonly onStale: () => Promise<boolean>;
}

interface RecordedBattery {
  readonly aisleName: string;
  readonly percent: number;
}

interface BatteryRecording {
  readonly onRecorded: (map: DashboardLotMap, recorded: RecordedBattery) => void;
  readonly onStale: () => Promise<boolean>;
}

// Everything a technician types into the beacons' app, one UUID, the lot's major, then one minor per aisle, and what each battery read last.
export function BeaconTable({ map, onSaved, onStale }: BeaconTableProps) {
  const text = useText();
  const [recorded, setRecorded] = useState<RecordedBattery | null>(null);
  const onRecorded = (saved: DashboardLotMap, reading: RecordedBattery) => {
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
      {map.levels.length === 0 ? <p className="muted">{text.map.noBeacons}</p> : <BatteryTable map={map} recording={{ onRecorded, onStale }} />}
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

function BatteryTable({ map, recording }: { readonly map: DashboardLotMap; readonly recording: BatteryRecording }) {
  const text = useText();
  const limits = useBatteryLimitValues();
  const columns = [text.map.levelColumn, text.map.aisleColumn, text.map.minorColumn, text.map.batteryColumn, text.map.readingColumn];
  return (
    <>
      <p className="lead lead-after-content">{interpolate(text.map.batteryHelp, limits)}</p>
      <div className="wide-table-scroll">
        <table className="data-table">
          <ColumnHeads labels={columns} />
          <tbody>
            {map.levels.map((level) => (
              <LevelBeaconRows key={level.id} lotId={map.lotId} level={level} recording={recording} />
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
  readonly recording: BatteryRecording;
}

function LevelBeaconRows({ lotId, level, recording }: LevelBeaconRowsProps) {
  return level.aisles.map((aisle) => <BeaconRow key={aisle.id} row={{ lotId, levelCode: level.code, aisle }} recording={recording} />);
}

interface BeaconRowData {
  readonly lotId: string;
  readonly levelCode: string;
  readonly aisle: DashboardMapAisle;
}

function BeaconRow({ row: { lotId, levelCode, aisle }, recording }: { readonly row: BeaconRowData; readonly recording: BatteryRecording }) {
  const { text, language } = useLanguage();
  const aisleName = useAisleName()(aisle);
  const mark = batteryMarkOf(aisle, text.map, language);
  return (
    <tr>
      <td>{levelCode}</td>
      <th scope="row">{aisleName}</th>
      <td className="number-cell">{String(aisle.beaconMinor)}</td>
      <td>
        <StateMark tone={mark.tone} label={<FiguresInText text={mark.label} />} />
      </td>
      <td className="wrapping-cell">
        <BeaconRowForm target={{ lotId, aisleId: aisle.id, aisleName }} recording={recording} />
      </td>
    </tr>
  );
}

interface BeaconRowTarget {
  readonly lotId: string;
  readonly aisleId: string;
  readonly aisleName: string;
}

function BeaconRowForm({ target, recording }: { readonly target: BeaconRowTarget; readonly recording: BatteryRecording }) {
  const { aisleName } = target;
  return <RecordBatteryForm {...target} onRecorded={(map, percent) => recording.onRecorded(map, { aisleName, percent })} onStale={recording.onStale} />;
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
