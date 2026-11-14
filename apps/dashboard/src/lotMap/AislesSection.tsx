import type { DashboardLotMap, DashboardMapLevel } from '@palier/shared-types';
import { useState } from 'react';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { AddAisleForm } from './AddAisleForm.tsx';
import { AisleTable } from './AisleTable.tsx';
import type { MapSectionProps } from './LevelsSection.tsx';

interface AddedAisle {
  readonly code: string;
  readonly level: string;
}

// One level at a time: its aisles, its plan and the form that adds an aisle to it. Hidden until the lot has a level.
export function AislesSection({ map, onSaved }: MapSectionProps) {
  const text = useText();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { added, recordAdded } = useAddedAisle(onSaved);
  const level = map.levels.find(({ id }) => id === selectedId) ?? map.levels[0];
  if (level === undefined) {
    return null;
  }
  return (
    <section className="section" aria-labelledby="aisles-title">
      <h2 id="aisles-title" className="section-title">
        {text.map.aislesTitle}
      </h2>
      <LevelSelect levels={map.levels} selectedId={level.id} onSelect={setSelectedId} />
      <AisleTable aisles={level.aisles} />
      <AddAisleForm key={level.id} lotId={map.lotId} level={level} onAdded={(saved, code) => recordAdded(saved, { code, level: level.code })} />
      <p role="status">{added === null ? null : interpolate(text.map.aisleAdded, { ...added })}</p>
    </section>
  );
}

function useAddedAisle(onSaved: (map: DashboardLotMap) => void) {
  const [added, setAdded] = useState<AddedAisle | null>(null);
  const recordAdded = (saved: DashboardLotMap, aisle: AddedAisle) => {
    onSaved(saved);
    setAdded(aisle);
  };
  return { added, recordAdded };
}

interface LevelSelectProps {
  readonly levels: readonly DashboardMapLevel[];
  readonly selectedId: string;
  readonly onSelect: (levelId: string) => void;
}

function LevelSelect({ levels, selectedId, onSelect }: LevelSelectProps) {
  const text = useText();
  return (
    <div className="field">
      <label htmlFor="aisles-level" className="field-label">
        {text.map.levelSelectLabel}
      </label>
      <select id="aisles-level" className="field-input field-select" value={selectedId} onChange={(event) => onSelect(event.target.value)}>
        {levels.map(({ id, code }) => (
          <option key={id} value={id}>
            {code}
          </option>
        ))}
      </select>
    </div>
  );
}
