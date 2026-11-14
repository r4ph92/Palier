import type { DashboardSpot, SpotState } from '@palier/shared-types';
import type { ReactNode } from 'react';
import { StableLabel } from '../components/StableLabel.tsx';
import { StateMark, type StateTone } from '../components/StateMark.tsx';
import { formatMetres } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { interpolateKeepingValuesWhole } from '../i18n/interpolateKeepingValuesWhole.tsx';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { closesOnEscape } from './closesOnEscape.ts';
import { flagLabelsOf, SPOT_FLAGS } from './spotFormValues.ts';
import { useFocusWhen } from './useFocusWhen.ts';
import type { SpotDeletion } from './useSpotDeletion.ts';

const COLUMN_COUNT = 5;

const STATE_TONES: Readonly<Record<SpotState, StateTone>> = {
  AVAILABLE: 'free',
  HELD: 'muted',
  ASSIGNED: 'muted',
  OCCUPIED: 'muted',
  OCCUPIED_UNKNOWN: 'muted',
  OUT_OF_SERVICE: 'danger',
};

interface SpotTableProps {
  readonly spots: readonly DashboardSpot[];
  readonly labelledBy: string;
  readonly deletion: SpotDeletion;
  readonly onEdit: (spot: DashboardSpot) => void;
  readonly editing: EditRow | null;
}

// The edit form, shown in a row right after the spot it edits.
export interface EditRow {
  readonly spotId: string;
  readonly form: ReactNode;
}

type RowProps = Pick<SpotTableProps, 'deletion' | 'onEdit'> & { readonly spot: DashboardSpot };

export function editButtonId(spot: DashboardSpot): string {
  return `spot-${spot.id}-edit`;
}

// Explicit roles keep the table a table for screen readers when narrow screens stack each row.
export function SpotTable({ spots, labelledBy, deletion, onEdit, editing }: SpotTableProps) {
  return (
    <table className="data-table spot-table" role="table" aria-labelledby={labelledBy} aria-busy={deletion.deleting}>
      <SpotTableHead />
      <tbody role="rowgroup">
        {spots.map((spot) => (
          <SpotRows key={spot.id} spot={spot} deletion={deletion} onEdit={onEdit} editForm={editing?.spotId === spot.id ? editing.form : null} />
        ))}
      </tbody>
    </table>
  );
}

function SpotTableHead() {
  const { spots: text } = useText().map;
  return (
    <thead role="rowgroup">
      <tr role="row">
        <SpotColumnHead label={text.numberColumn} />
        <SpotColumnHead label={text.attributesColumn} />
        <SpotColumnHead label={text.distanceColumn} className="spot-distance" />
        <SpotColumnHead label={text.stateColumn} />
        <SpotColumnHead label={<span className="visually-hidden">{text.actionsColumn}</span>} />
      </tr>
    </thead>
  );
}

function SpotColumnHead({ label, className }: { readonly label: ReactNode; readonly className?: string }) {
  return (
    <th scope="col" role="columnheader" className={className}>
      {label}
    </th>
  );
}

function SpotRows({ editForm, ...row }: RowProps & { readonly editForm: ReactNode }) {
  return (
    <>
      <SpotRow {...row} />
      {editForm === null ? null : (
        <tr role="row" className="spot-edit-row">
          <td role="cell" colSpan={COLUMN_COUNT}>
            {editForm}
          </td>
        </tr>
      )}
    </>
  );
}

function SpotRow({ spot, deletion, onEdit }: RowProps) {
  const { text, language } = useLanguage();
  return (
    <tr role="row">
      <th scope="row" role="rowheader" className="spot-number">
        {spot.number}
      </th>
      <AttributesCell spot={spot} />
      <td role="cell" className="spot-distance">
        {formatMetres(spot.distanceToExit, language)}
      </td>
      <td role="cell" className="spot-state">
        <StateMark tone={STATE_TONES[spot.state]} label={text.spotStates[spot.state]} />
      </td>
      <td role="cell" className="spot-actions">
        {deletion.confirming?.id === spot.id ? <DeleteConfirmation spot={spot} deletion={deletion} /> : <RowActions spot={spot} deletion={deletion} onEdit={onEdit} />}
      </td>
    </tr>
  );
}

function AttributesCell({ spot }: { readonly spot: DashboardSpot }) {
  const { spots: text } = useText().map;
  const labels = flagLabelsOf(text);
  const attributes = SPOT_FLAGS.filter((flag) => spot[flag]).map((flag) => labels[flag]);
  return (
    <td role="cell" className="spot-attributes">
      {attributes.length === 0 ? <span className="muted">{text.noAttribute}</span> : attributes.join(', ')}
    </td>
  );
}

function RowActions({ spot, deletion, onEdit }: RowProps) {
  const { spots: text } = useText().map;
  const values = { number: spot.number };
  const deleteRef = useFocusWhen<HTMLButtonElement>(deletion.cancelledId === spot.id);
  return (
    <span className="row-actions">
      <button type="button" id={editButtonId(spot)} className="text-button" aria-label={interpolate(text.edit.name, values)} onClick={() => onEdit(spot)}>
        {text.edit.shown}
      </button>
      <button type="button" ref={deleteRef} className="text-button" aria-label={interpolate(text.delete.name, values)} onClick={() => deletion.ask(spot)}>
        {text.delete.shown}
      </button>
    </span>
  );
}

// The confirm button takes focus as the row asks; Escape cancels like the cancel button.
function DeleteConfirmation({ spot, deletion }: { readonly spot: DashboardSpot; readonly deletion: SpotDeletion }) {
  const { spots: text } = useText().map;
  const confirmRef = useFocusWhen<HTMLButtonElement>(true);
  const label = interpolate(text.confirmDeleteButton.name, { number: spot.number });
  return (
    <span className="row-actions delete-question" onKeyDown={(event) => closesOnEscape(event, deletion.cancel)}>
      <span>{interpolateKeepingValuesWhole(text.confirmDelete, { number: spot.number })}</span>
      <button type="button" ref={confirmRef} className="text-button" aria-label={label} aria-disabled={deletion.deleting} onClick={() => void deletion.confirm()}>
        <StableLabel shown={deletion.deleting ? text.deleting : text.confirmDeleteButton.shown} reserved={[text.deleting, text.confirmDeleteButton.shown]} />
      </button>
      <button type="button" className="text-button" onClick={deletion.cancel}>
        {text.cancel}
      </button>
    </span>
  );
}
