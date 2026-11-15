import type { DashboardSpot } from '@palier/shared-types';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StableLabel } from '../components/StableLabel.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { interpolateKeepingValuesWhole } from '../i18n/interpolateKeepingValuesWhole.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { closesOnEscape } from './closesOnEscape.ts';
import type { RowRefusal } from './rowRefusal.ts';
import { useFocusWhen } from './useFocusWhen.ts';
import type { SpotDeletion } from './useSpotDeletion.ts';
import { serviceActionOf, type SpotService } from './useSpotService.ts';

export interface SpotRowProps {
  readonly spot: DashboardSpot;
  readonly deletion: SpotDeletion;
  readonly service: SpotService;
  readonly onEdit: (spot: DashboardSpot) => void;
  readonly refusal: RowRefusal | null;
}

export function editButtonId(spot: DashboardSpot): string {
  return `spot-${spot.id}-edit`;
}

export function ActionsCell({ refusal, ...row }: SpotRowProps) {
  return (
    <td role="cell" className="spot-actions">
      {row.deletion.confirming?.id === row.spot.id ? <DeleteConfirmation spot={row.spot} deletion={row.deletion} /> : <RowActions {...row} />}
      <RowRefusalNotice refusal={refusal} />
    </td>
  );
}

function RowRefusalNotice({ refusal }: { readonly refusal: RowRefusal | null }) {
  if (refusal === null) {
    return null;
  }
  return <ErrorNotice key={refusal.noticeKey} code={refusal.refusal.code} values={refusal.refusal.values} takesFocus />;
}

function RowActions({ spot, deletion, service, onEdit }: Omit<SpotRowProps, 'refusal'>) {
  const { spots: text } = useText().map;
  const values = { number: spot.number };
  const deleteRef = useFocusWhen<HTMLButtonElement>(deletion.cancelledId === spot.id);
  return (
    <span className="row-actions">
      <button type="button" id={editButtonId(spot)} className="text-button" aria-label={interpolate(text.edit.name, values)} onClick={() => onEdit(spot)}>
        {text.edit.shown}
      </button>
      <ServiceButton spot={spot} service={service} />
      <button type="button" ref={deleteRef} className="text-button" aria-label={interpolate(text.delete.name, values)} onClick={() => deletion.ask(spot)}>
        {text.delete.shown}
      </button>
    </span>
  );
}

function ServiceButton({ spot, service }: { readonly spot: DashboardSpot; readonly service: SpotService }) {
  const { spots: text } = useText().map;
  const label = text[serviceActionOf(spot)];
  const shown = service.busySpotId === spot.id ? label.busy : label.shown;
  return (
    <button type="button" className="text-button" aria-label={interpolate(label.name, { number: spot.number })} aria-disabled={service.busy} onClick={() => void service.toggle(spot)}>
      <StableLabel shown={shown} reserved={[text.takeOutOfService.shown, text.putBackInService.shown, text.takeOutOfService.busy, text.putBackInService.busy]} />
    </button>
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
