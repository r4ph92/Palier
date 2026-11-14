import type { DashboardAisleSpots, DashboardMapAisle, DashboardSpot } from '@palier/shared-types';
import { useState } from 'react';
import type { Refusal } from '../api/followUpRefusal.ts';
import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { pluralFormOf } from '../i18n/plural.ts';
import { EditSpotForm } from './EditSpotForm.tsx';
import { SpotNoticeLine } from './SpotNoticeLine.tsx';
import { PageTurns, SpotPager } from './SpotPager.tsx';
import { editButtonId, SpotTable, type EditRow } from './SpotTable.tsx';
import { useFocusAfterRender } from './useFocusAfterRender.ts';
import type { SpotChanges } from './useSpotChanges.ts';
import { useSpotDeletion } from './useSpotDeletion.ts';
import { useSpotPage } from './useSpotPage.ts';

interface SpotListProps {
  readonly lotId: string;
  readonly aisle: DashboardMapAisle;
  readonly spots: readonly DashboardSpot[];
  readonly changes: SpotChanges;
}

// One edit form at a time, right after its row; focus goes back to the row's edit button when it closes, to the title after a delete.
export function SpotList({ lotId, aisle, spots, changes }: SpotListProps) {
  const text = useText();
  const titleId = `spot-list-${aisle.id}`;
  const focusAfterRender = useFocusAfterRender();
  const editing = useSpotEditing(changes, { focusAfterRender, titleId });
  const page = useSpotPage(spots, editing.close, changes.pageRequest);
  const deletion = useListDeletion(lotId, changes, () => focusAfterRender(titleId));
  const editRow = editRowOf(lotId, editing, changes);
  return (
    <>
      <SpotListTitle id={titleId} aisle={aisle.code} count={spots.length} />
      <SpotNoticeLine key={changes.noticeKey} notice={changes.notice} />
      <SpotPager page={page} />
      {spots.length === 0 ? <EmptyAisle /> : <SpotTable spots={page.spots} labelledBy={titleId} deletion={deletion} onEdit={editing.open} editing={editRow} />}
      <PageTurns page={page} label={text.map.spots.page.labelBelow} />
    </>
  );
}

function useListDeletion(lotId: string, changes: SpotChanges, focusTitle: () => void) {
  const onDeleted = (saved: DashboardAisleSpots, spot: DashboardSpot) => {
    changes.deleted(saved, spot);
    focusTitle();
  };
  return useSpotDeletion({ lotId, onDeleted, onRefused: changes.refused, staleData: changes.staleData });
}

function editRowOf(lotId: string, editing: SpotEditing, { staleData }: SpotChanges): EditRow | null {
  const { spot } = editing;
  if (spot === null) {
    return null;
  }
  const form = <EditSpotForm key={spot.id} lotId={lotId} spot={spot} onSaved={editing.saved} onGone={editing.gone} staleData={staleData} onCancel={editing.cancel} />;
  return { spotId: spot.id, form };
}

function SpotListTitle({ id, aisle, count }: { readonly id: string; readonly aisle: string; readonly count: number }) {
  const { text, language } = useLanguage();
  return (
    <h3 id={id} tabIndex={-1} className="subsection-title">
      {interpolate(pluralFormOf(text.map.spots.listTitle, count, language), { aisle, count: formatCount(count, language) })}
    </h3>
  );
}

function EmptyAisle() {
  const text = useText();
  return <p className="muted">{text.map.spots.empty}</p>;
}

interface EditingFocus {
  readonly focusAfterRender: (elementId: string) => void;
  readonly titleId: string;
}

type SpotEditing = ReturnType<typeof useSpotEditing>;

function useSpotEditing(changes: SpotChanges, { focusAfterRender, titleId }: EditingFocus) {
  const [spot, setSpot] = useState<DashboardSpot | null>(null);
  const closeFocusing = (elementId: string) => {
    setSpot(null);
    focusAfterRender(elementId);
  };
  const closeReturningFocus = () => closeFocusing(spot === null ? titleId : editButtonId(spot));
  const saved = (spots: DashboardAisleSpots) => {
    if (spot !== null) {
      changes.saved(spots, spot);
    }
    closeReturningFocus();
  };
  const close = () => setSpot(null);
  const gone = (refusal: Refusal) => {
    changes.refused(refusal);
    close();
  };
  return { spot, open: setSpot, cancel: closeReturningFocus, close, saved, gone };
}
