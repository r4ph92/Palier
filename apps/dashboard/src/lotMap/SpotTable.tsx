import type { DashboardSpot } from '@palier/shared-types';
import { ColumnHeads } from '../components/ColumnHeads.tsx';
import { formatMetres } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { flagLabelsOf } from './SpotAttributeFields.tsx';
import { SPOT_FLAGS } from './spotFormValues.ts';
import { useFocusWhen } from './useFocusWhen.ts';
import type { SpotDeletion } from './useSpotDeletion.ts';

interface SpotTableProps {
  readonly spots: readonly DashboardSpot[];
  readonly deletion: SpotDeletion;
  readonly onEdit: (spot: DashboardSpot) => void;
}

export function editButtonId(spot: DashboardSpot): string {
  return `spot-${spot.id}-edit`;
}

export function SpotTable({ spots, deletion, onEdit }: SpotTableProps) {
  const { spots: text } = useText().map;
  return (
    <table className="data-table" aria-busy={deletion.deleting}>
      <ColumnHeads labels={[text.numberColumn, text.attributesColumn, text.distanceColumn, text.stateColumn, text.actionsColumn]} />
      <tbody>
        {spots.map((spot) => (
          <SpotRow key={spot.id} spot={spot} deletion={deletion} onEdit={onEdit} />
        ))}
      </tbody>
    </table>
  );
}

function SpotRow({ spot, deletion, onEdit }: { readonly spot: DashboardSpot } & Omit<SpotTableProps, 'spots'>) {
  const { text, language } = useLanguage();
  const labels = flagLabelsOf(text.map.spots);
  const attributes = SPOT_FLAGS.filter((flag) => spot[flag]).map((flag) => labels[flag]);
  return (
    <tr>
      <th scope="row">{spot.number}</th>
      <td>{attributes.length === 0 ? <span className="muted">{text.map.spots.noAttribute}</span> : attributes.join(', ')}</td>
      <td className="number-cell">{formatMetres(spot.distanceToExit, language)}</td>
      <td>{text.spotStates[spot.state]}</td>
      <td>{deletion.confirming?.id === spot.id ? <DeleteConfirmation spot={spot} deletion={deletion} /> : <RowActions spot={spot} deletion={deletion} onEdit={onEdit} />}</td>
    </tr>
  );
}

// A row whose question was just cancelled gives focus back to its delete button.
function RowActions({ spot, deletion, onEdit }: { readonly spot: DashboardSpot } & Omit<SpotTableProps, 'spots'>) {
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

// The confirm button takes focus as the row asks.
function DeleteConfirmation({ spot, deletion }: { readonly spot: DashboardSpot; readonly deletion: SpotDeletion }) {
  const { spots: text } = useText().map;
  const confirmRef = useFocusWhen<HTMLButtonElement>(true);
  return (
    <span className="row-actions">
      <span>{interpolate(text.confirmDelete, { number: spot.number })}</span>
      <button type="button" ref={confirmRef} className="text-button" aria-label={interpolate(text.confirmDeleteButton.name, { number: spot.number })} aria-disabled={deletion.deleting} onClick={() => void deletion.confirm()}>
        {deletion.deleting ? text.deleting : text.confirmDeleteButton.shown}
      </button>
      <button type="button" className="text-button" onClick={deletion.cancel}>
        {text.cancel}
      </button>
    </span>
  );
}
