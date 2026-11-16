import type { DashboardSpot, SpotState } from '@palier/shared-types';
import { Fragment, type ReactNode } from 'react';
import { StateMark, type StateTone } from '../components/StateMark.tsx';
import { formatMetres } from '../i18n/formatNumbers.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import type { RowRefusal } from './rowRefusal.ts';
import { ActionsCell, type SpotRowProps } from './SpotRowActions.tsx';
import { flagLabelsOf, SPOT_FLAGS } from './spotFormValues.ts';
import type { SpotDeletion } from './useSpotDeletion.ts';
import type { SpotService } from './useSpotService.ts';

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
  readonly service: SpotService;
  readonly onEdit: (spot: DashboardSpot) => void;
  readonly editing: EditRow | null;
  readonly rowRefusal: RowRefusal | null;
}

// The edit form, shown in a row right after the spot it edits.
export interface EditRow {
  readonly spotId: string;
  readonly form: ReactNode;
}

// Explicit roles keep the table a table for screen readers when narrow screens stack each row.
export function SpotTable({ spots, labelledBy, deletion, service, onEdit, editing, rowRefusal }: SpotTableProps) {
  return (
    <table className="data-table stacked-table spot-table" role="table" aria-labelledby={labelledBy} aria-busy={deletion.deleting || service.busy}>
      <SpotTableHead />
      <tbody role="rowgroup">
        {spots.map((spot) => (
          <SpotRows key={spot.id} spot={spot} deletion={deletion} service={service} onEdit={onEdit} refusal={rowRefusal?.spotId === spot.id ? rowRefusal : null} editForm={editing?.spotId === spot.id ? editing.form : null} />
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

function SpotRows({ editForm, ...row }: SpotRowProps & { readonly editForm: ReactNode }) {
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

function SpotRow({ spot, deletion, service, onEdit, refusal }: SpotRowProps) {
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
        <StateMark tone={STATE_TONES[spot.state]} label={text.spotStates[spot.state]} wraps={spot.state === 'OCCUPIED_UNKNOWN'} />
      </td>
      <ActionsCell spot={spot} deletion={deletion} service={service} onEdit={onEdit} refusal={refusal} />
    </tr>
  );
}

function AttributesCell({ spot }: { readonly spot: DashboardSpot }) {
  const { spots: text } = useText().map;
  const labels = flagLabelsOf(text);
  const attributes = SPOT_FLAGS.filter((flag) => spot[flag]);
  return (
    <td role="cell" className="spot-attributes">
      {attributes.length === 0 ? (
        <span className="muted">{text.noAttribute}</span>
      ) : (
        attributes.map((flag, index) => (
          <Fragment key={flag}>
            {index === 0 ? null : ', '}
            <span className="spot-attribute">{labels[flag]}</span>
          </Fragment>
        ))
      )}
    </td>
  );
}
