import type { AisleRectangle, DashboardMapAisle } from '@palier/shared-types';
import { useId } from 'react';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { planFrameOf } from './planFrame.ts';
import type { DraftAisle } from './useAddAisleForm.ts';

interface PlanPreviewProps {
  readonly levelCode: string;
  readonly aisles: readonly DashboardMapAisle[];
  // The aisle being added, drawn dashed and labelled with its code: a dashed outline, not a colour, tells it from the saved aisles.
  readonly draft: DraftAisle | null;
}

type DrawnAisle = DashboardMapAisle & { readonly rectangle: AisleRectangle };

// Nothing at all for a level without aisles, which the aisle list already says.
// Framed by the bounding box of what is drawn, like the app's plan, so the drawing fills the width wherever the aisles sit on the grid.
export function PlanPreview({ levelCode, aisles, draft }: PlanPreviewProps) {
  const text = useText();
  const descriptionId = useId();
  const drawn = aisles.filter((aisle): aisle is DrawnAisle => aisle.rectangle !== null);
  if (drawn.length === 0 && draft === null) {
    return aisles.length === 0 ? null : <p className="muted">{text.map.planEmpty}</p>;
  }
  return (
    <figure className="plan-preview">
      <PlanDrawing label={interpolate(text.map.planLabel, { code: levelCode })} descriptionId={descriptionId} drawn={drawn} draft={draft} />
      <figcaption id={descriptionId} className="muted">
        <PlanDescription drawn={drawn} hasDraft={draft !== null} />
      </figcaption>
    </figure>
  );
}

interface PlanDrawingProps {
  readonly label: string;
  readonly descriptionId: string;
  readonly drawn: readonly DrawnAisle[];
  readonly draft: DraftAisle | null;
}

function PlanDrawing({ label, descriptionId, drawn, draft }: PlanDrawingProps) {
  const { x, y, width, height } = planFrameOf([...drawn.map(({ rectangle }) => rectangle), ...(draft === null ? [] : [draft.rectangle])]);
  return (
    <svg role="img" aria-label={label} aria-describedby={descriptionId} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
      {drawn.map((aisle) => (
        <PlanRectangle key={aisle.id} rectangle={aisle.rectangle} label={aisle.code} />
      ))}
      {draft === null ? null : <PlanRectangle rectangle={draft.rectangle} label={draft.label} isDraft />}
    </svg>
  );
}

function PlanDescription({ drawn, hasDraft }: { readonly drawn: readonly DrawnAisle[]; readonly hasDraft: boolean }) {
  const text = useText();
  const drawnLine = drawn.length === 0 ? '' : interpolate(text.map.planAisles, { codes: drawn.map(({ code }) => code).join(', ') });
  return [drawnLine, hasDraft ? text.map.planDraft : ''].filter((line) => line !== '').join(' ');
}

interface PlanRectangleProps {
  readonly rectangle: AisleRectangle;
  readonly label: string;
  readonly isDraft?: boolean;
}

// Strokes keep their screen width whatever the scale of the grid; the code is sized to its rectangle.
function PlanRectangle({ rectangle, label, isDraft = false }: PlanRectangleProps) {
  const fontSize = Math.min(rectangle.width, rectangle.height) / 2;
  return (
    <g className={isDraft ? 'plan-aisle plan-aisle-draft' : 'plan-aisle'}>
      <rect x={rectangle.x} y={rectangle.y} width={rectangle.width} height={rectangle.height} vectorEffect="non-scaling-stroke" />
      <text x={rectangle.x + rectangle.width / 2} y={rectangle.y + rectangle.height / 2} fontSize={fontSize} textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  );
}
