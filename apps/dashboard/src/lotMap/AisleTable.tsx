import type { DashboardMapAisle } from '@palier/shared-types';
import { ColumnHeads } from '../components/ColumnHeads.tsx';
import { formatCount } from '../i18n/formatNumbers.ts';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';

// The exit lane is named by its role, never by its stored code, so the page reads in the operator's language.
export function useAisleName(): (aisle: DashboardMapAisle) => string {
  const text = useText();
  return (aisle) => (aisle.isExitLane ? text.map.exitLane : aisle.code);
}

export function AisleTable({ aisles }: { readonly aisles: readonly DashboardMapAisle[] }) {
  const text = useText();
  if (aisles.length === 0) {
    return <p className="muted">{text.map.noAisles}</p>;
  }
  return (
    <table className="data-table">
      <ColumnHeads labels={[text.map.aisleColumn, text.map.minorColumn, text.map.rectangleColumn]} />
      <tbody>
        {aisles.map((aisle) => (
          <AisleRow key={aisle.id} aisle={aisle} />
        ))}
      </tbody>
    </table>
  );
}

function AisleRow({ aisle }: { readonly aisle: DashboardMapAisle }) {
  const { text, language } = useLanguage();
  const nameOf = useAisleName();
  const { rectangle } = aisle;
  const sides = rectangle === null ? null : Object.fromEntries(Object.entries(rectangle).map(([side, value]) => [side, formatCount(value, language)]));
  return (
    <tr>
      <th scope="row">{nameOf(aisle)}</th>
      <td className="number-cell">{String(aisle.beaconMinor)}</td>
      <td>{sides === null ? text.map.notDrawn : interpolate(text.map.rectangle, sides)}</td>
    </tr>
  );
}
