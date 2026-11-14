import type { DashboardAisleSpots, DashboardMapAisle, DashboardSpot } from '@palier/shared-types';
import { useState } from 'react';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { EditSpotForm } from './EditSpotForm.tsx';
import { editButtonId, SpotTable } from './SpotTable.tsx';
import { useFocusAfterRender } from './useFocusAfterRender.ts';
import { useSpotDeletion, type SpotDeletion } from './useSpotDeletion.ts';
import type { SpotStatus } from './useSpotStatus.ts';

interface SpotListProps {
  readonly lotId: string;
  readonly aisle: DashboardMapAisle;
  readonly spots: readonly DashboardSpot[];
  readonly status: SpotStatus;
}

// The aisle's spots with one edit form at a time; focus goes back to the row's edit button when the form closes, to the title after a delete.
export function SpotList({ lotId, aisle, spots, status }: SpotListProps) {
  const text = useText();
  const titleId = `spot-list-${aisle.id}`;
  const focusAfterRender = useFocusAfterRender();
  const editing = useSpotEditing(status, focusAfterRender);
  const deletion = useSpotDeletion({ lotId, onRefused: status.refused, onDeleted: (saved, spot) => (status.deleted(saved, spot), focusAfterRender(titleId)) });
  return (
    <>
      <h3 id={titleId} tabIndex={-1} className="subsection-title">
        {interpolate(text.map.spots.listTitle, { aisle: aisle.code })}
      </h3>
      <SpotRows spots={spots} deletion={deletion} onEdit={editing.open} />
      {editing.spot === null ? null : (
        <EditSpotForm key={editing.spot.id} lotId={lotId} spot={editing.spot} onSaved={editing.saved} onRefused={status.refused} onCancel={editing.close} />
      )}
    </>
  );
}

function useSpotEditing(status: SpotStatus, focusAfterRender: (elementId: string) => void) {
  const [spot, setSpot] = useState<DashboardSpot | null>(null);
  const close = () => {
    setSpot(null);
    if (spot !== null) {
      focusAfterRender(editButtonId(spot));
    }
  };
  const saved = (spots: DashboardAisleSpots) => {
    if (spot !== null) {
      status.saved(spots, spot);
    }
    close();
  };
  return { spot, open: setSpot, close, saved };
}

interface SpotRowsProps {
  readonly spots: readonly DashboardSpot[];
  readonly deletion: SpotDeletion;
  readonly onEdit: (spot: DashboardSpot) => void;
}

function SpotRows({ spots, deletion, onEdit }: SpotRowsProps) {
  const text = useText();
  if (spots.length === 0) {
    return <p className="muted">{text.map.spots.empty}</p>;
  }
  return (
    <>
      {deletion.error === null ? null : <ErrorNotice code={deletion.error} takesFocus />}
      <SpotTable spots={spots} deletion={deletion} onEdit={onEdit} />
    </>
  );
}
