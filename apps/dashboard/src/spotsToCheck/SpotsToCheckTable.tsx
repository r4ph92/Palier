import type { DashboardSpotToCheck } from '@palier/shared-types';
import { ColumnHeads } from '../components/ColumnHeads.tsx';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { formatDateTime } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import type { SpotCheckClearing } from './useSpotCheckClearing.ts';

export function errorIdOf(spot: DashboardSpotToCheck): string {
  return `spot-${spot.spotId}-check-error`;
}

export function SpotsToCheckTable({ clearing }: { readonly clearing: SpotCheckClearing }) {
  const { spotsToCheck: text } = useText();
  return (
    <div className="table-scroll">
      <table className="data-table" aria-busy={clearing.clearingId !== null}>
        <caption className="visually-hidden">{text.caption}</caption>
        <ColumnHeads labels={[text.spotColumn, text.placeColumn, text.sinceColumn, text.reasonColumn, text.checkColumn]} />
        <tbody>
          {clearing.spots.map((spot) => (
            <SpotToCheckRow key={spot.spotId} spot={spot} clearing={clearing} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpotToCheckRow({ spot, clearing }: { readonly spot: DashboardSpotToCheck; readonly clearing: SpotCheckClearing }) {
  const { text, language } = useLanguage();
  const reason = spot.reason === null ? text.spotsToCheck.reasons.NOT_RECORDED : text.spotsToCheck.reasons[spot.reason];
  const since = new Date(spot.since);
  return (
    <tr>
      <th scope="row">{spot.number}</th>
      <td>{interpolate(text.spotsToCheck.place, { level: spot.levelCode, aisle: spot.aisleCode })}</td>
      <td>
        <time dateTime={spot.since}>{formatDateTime(since, language)}</time>
      </td>
      <td>{reason}</td>
      <td>
        <CheckedButton spot={spot} clearing={clearing} />
      </td>
    </tr>
  );
}

function CheckedButton({ spot, clearing }: { readonly spot: DashboardSpotToCheck; readonly clearing: SpotCheckClearing }) {
  const { spotsToCheck: text } = useText();
  const isBusy = clearing.clearingId === spot.spotId;
  const refused = clearing.refusal?.spotId === spot.spotId ? clearing.refusal : null;
  return (
    <span className="row-actions">
      <button
        type="button"
        className="text-button"
        aria-label={interpolate(text.checked.name, { number: spot.number })}
        aria-describedby={refused === null ? undefined : errorIdOf(spot)}
        aria-disabled={clearing.clearingId !== null}
        onClick={() => void clearing.clear(spot)}
      >
        {isBusy ? text.checking : text.checked.shown}
      </button>
      {refused === null ? null : <ErrorNotice code={refused.code} id={errorIdOf(spot)} takesFocus />}
    </span>
  );
}
