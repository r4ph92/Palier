import type { DashboardLotMap, DashboardMapAisle } from '@palier/shared-types';
import { useState } from 'react';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { AisleSpots } from './AisleSpots.tsx';

interface SpotsSectionProps {
  readonly map: DashboardLotMap;
  readonly onStale: () => Promise<boolean>;
}

interface ParkingAisle {
  readonly aisle: DashboardMapAisle;
  readonly level: string;
}

// The exit lane has no spots, so it is never offered.
function parkingAislesOf(map: DashboardLotMap): ParkingAisle[] {
  return map.levels.flatMap((level) => level.aisles.filter(({ isExitLane }) => !isExitLane).map((aisle) => ({ aisle, level: level.code })));
}

// One aisle at a time, picked across every level: its spots, their attributes and the form that adds more. Hidden until the lot has a level.
export function SpotsSection({ map, onStale }: SpotsSectionProps) {
  const text = useText();
  if (map.levels.length === 0) {
    return null;
  }
  return (
    <section className="section" aria-labelledby="spots-title">
      <h2 id="spots-title" className="section-title">
        {text.map.spots.title}
      </h2>
      <SelectedAisleSpots map={map} onStale={onStale} />
    </section>
  );
}

function SelectedAisleSpots({ map, onStale }: SpotsSectionProps) {
  const text = useText();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const aisles = parkingAislesOf(map);
  const selected = aisles.find(({ aisle }) => aisle.id === selectedId) ?? aisles[0];
  if (selected === undefined) {
    return <p className="muted">{text.map.spots.noParkingAisles}</p>;
  }
  return (
    <>
      <AisleSelect aisles={aisles} selectedId={selected.aisle.id} onSelect={setSelectedId} />
      <AisleSpots key={selected.aisle.id} lotId={map.lotId} aisle={selected.aisle} onStale={onStale} />
    </>
  );
}

interface AisleSelectProps {
  readonly aisles: readonly ParkingAisle[];
  readonly selectedId: string;
  readonly onSelect: (aisleId: string) => void;
}

function AisleSelect({ aisles, selectedId, onSelect }: AisleSelectProps) {
  const text = useText();
  return (
    <div className="field">
      <label htmlFor="spots-aisle" className="field-label">
        {text.map.spots.aisleSelectLabel}
      </label>
      <select id="spots-aisle" className="field-input field-select field-select-wide" value={selectedId} onChange={(event) => onSelect(event.target.value)}>
        {aisles.map(({ aisle, level }) => (
          <option key={aisle.id} value={aisle.id}>
            {interpolate(text.map.spots.aisleOption, { level, aisle: aisle.code })}
          </option>
        ))}
      </select>
    </div>
  );
}
