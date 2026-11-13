import type { DashboardLotMap } from '@palier/shared-types';
import { useState } from 'react';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { AddLevelForm } from './AddLevelForm.tsx';
import { LevelOrderList } from './LevelOrderList.tsx';

export interface MapSectionProps {
  readonly map: DashboardLotMap;
  readonly onSaved: (map: DashboardLotMap) => void;
}

interface LevelsSectionProps extends MapSectionProps {
  readonly onStale: () => Promise<boolean>;
}

export function LevelsSection({ map, onSaved, onStale }: LevelsSectionProps) {
  const text = useText();
  const [addedCode, setAddedCode] = useState<string | null>(null);
  const onAdded = (saved: DashboardLotMap, code: string) => {
    onSaved(saved);
    setAddedCode(code);
  };
  return (
    <section className="section" aria-labelledby="levels-title">
      <h2 id="levels-title" className="section-title">
        {text.map.levelsTitle}
      </h2>
      <p className="lead">{map.levels.length === 0 ? text.map.noLevels : text.map.levelsHelp}</p>
      {map.levels.length === 0 ? null : <LevelOrderList lotId={map.lotId} levels={map.levels} onSaved={onSaved} onStale={onStale} />}
      <AddLevelForm lotId={map.lotId} onAdded={onAdded} emphasis={map.levels.length === 0 ? 'primary' : 'secondary'} />
      <p role="status">{addedCode === null ? null : interpolate(text.map.levelAdded, { code: addedCode })}</p>
    </section>
  );
}
