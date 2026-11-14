import type { DashboardSpotToCheck } from '@palier/shared-types';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { StateMark, type StateTone } from '../components/StateMark.tsx';
import { formatRecentDateTime } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { checkButtonId, checkErrorId } from './spotCheckIds.ts';
import type { SpotCheckClearing } from './useSpotCheckClearing.ts';

interface SpotsToCheckTableProps {
  readonly spots: readonly DashboardSpotToCheck[];
  readonly clearing: SpotCheckClearing;
  readonly labelledBy: string;
}

type RowProps = Pick<SpotsToCheckTableProps, 'clearing'> & { readonly spot: DashboardSpotToCheck };

// Explicit roles keep the table a table for screen readers when narrow screens stack each row.
export function SpotsToCheckTable({ spots, clearing, labelledBy }: SpotsToCheckTableProps) {
  return (
    <table className="data-table check-table" role="table" aria-labelledby={labelledBy}>
      <SpotsToCheckHead />
      <tbody role="rowgroup">
        {spots.map((spot) => (
          <SpotToCheckRow key={spot.spotId} spot={spot} clearing={clearing} />
        ))}
      </tbody>
    </table>
  );
}

function SpotsToCheckHead() {
  const { spotsToCheck: text } = useText();
  return (
    <thead role="rowgroup">
      <tr role="row">
        {[text.spotColumn, text.placeColumn, text.stateColumn, text.sinceColumn, text.reasonColumn].map((label) => (
          <th key={label} scope="col" role="columnheader">
            {label}
          </th>
        ))}
        <th scope="col" role="columnheader">
          <span className="visually-hidden">{text.checkColumn}</span>
        </th>
      </tr>
    </thead>
  );
}

function SpotToCheckRow({ spot, clearing }: RowProps) {
  return (
    <tr role="row" className="check-row" aria-busy={clearing.clearingId === spot.spotId}>
      <th scope="row" role="rowheader" className="check-number">
        {spot.number}
      </th>
      <PlaceCells spot={spot} />
      <SinceCell since={spot.since} />
      <ReasonCell reason={spot.reason} />
      <td role="cell" className="check-action">
        <CheckedButton spot={spot} clearing={clearing} />
      </td>
    </tr>
  );
}

function PlaceCells({ spot }: { readonly spot: DashboardSpotToCheck }) {
  const { spotsToCheck: text } = useText();
  return (
    <>
      <td role="cell" className="check-place">
        {interpolate(text.place, { level: spot.levelCode, aisle: spot.aisleCode })}
      </td>
      <td role="cell" className="check-state">
        <SpotStateMark spot={spot} />
      </td>
    </>
  );
}

function ReasonCell({ reason }: { readonly reason: DashboardSpotToCheck['reason'] }) {
  const { spotsToCheck: text } = useText();
  return (
    <td role="cell" className="check-reason">
      {text.reasons[reason ?? 'NOT_RECORDED']}
    </td>
  );
}

function SinceCell({ since }: { readonly since: string }) {
  const { language } = useLanguage();
  return (
    <td role="cell" className="check-since">
      <time dateTime={since}>{formatRecentDateTime(new Date(since), language, new Date())}</time>
    </td>
  );
}

// Only a free spot nothing holds reads as free: a free one an active session still points at is not.
function SpotStateMark({ spot }: { readonly spot: DashboardSpotToCheck }) {
  const { spotStates, spotsToCheck } = useText();
  const heldByASession = spot.state === 'AVAILABLE' && !spot.clearable;
  const tone: StateTone = spot.clearable ? 'free' : 'muted';
  return <StateMark tone={tone} label={heldByASession ? spotsToCheck.heldBySession : spotStates[spot.state]} />;
}

function CheckedButton({ spot, clearing }: RowProps) {
  const { spotsToCheck: text } = useText();
  const refused = clearing.refusal?.spotId === spot.spotId ? clearing.refusal : null;
  return (
    <span className="row-actions">
      <button
        type="button"
        id={checkButtonId(spot.spotId)}
        className="text-button"
        aria-label={interpolate(text.checked.name, { number: spot.number })}
        aria-describedby={refused === null ? undefined : checkErrorId(spot.spotId)}
        aria-disabled={clearing.clearingId !== null}
        onClick={() => void clearing.clear(spot)}
      >
        {text.checked.shown}
      </button>
      {refused === null ? null : <ErrorNotice code={refused.code} id={checkErrorId(spot.spotId)} values={refused.values} takesFocus />}
    </span>
  );
}
