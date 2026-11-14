import type { AisleRectangle, DashboardMapAisle } from '@palier/shared-types';
import { useId } from 'react';
import { interpolate } from '../i18n/interpolate.ts';
import { useText } from '../i18n/LanguageContext.tsx';
import { planLayoutOf, type LabelPlacement, type PlacedAisle, type PlanAisleShape } from './planLayout.ts';
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

// The draft comes last, so it draws over the saved aisles it may overlap.
function PlanDrawing({ label, descriptionId, drawn, draft }: PlanDrawingProps) {
  const shapes: PlanAisleShape[] = drawn.map(({ rectangle, code }) => ({ rectangle, label: code }));
  const layout = planLayoutOf(draft === null ? shapes : [...shapes, draft]);
  const { x, y, width, height } = layout.frame;
  return (
    <svg role="img" aria-label={label} aria-describedby={descriptionId} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
      {layout.aisles.map((aisle, index) => (
        <PlanRectangle key={drawn[index]?.id ?? 'draft'} aisle={aisle} isDraft={index >= drawn.length} />
      ))}
    </svg>
  );
}

function PlanDescription({ drawn, hasDraft }: { readonly drawn: readonly DrawnAisle[]; readonly hasDraft: boolean }) {
  const text = useText();
  const drawnLine = drawn.length === 0 ? '' : interpolate(text.map.planAisles, { codes: drawn.map(({ code }) => code).join(', ') });
  return [drawnLine, hasDraft ? text.map.planDraft : ''].filter((line) => line !== '').join(' ');
}

interface PlanRectangleProps {
  readonly aisle: PlacedAisle;
  readonly isDraft: boolean;
}

// Strokes keep their screen width whatever the scale of the grid; the code sits inside when it fits, beside in muted mono otherwise.
function PlanRectangle({ aisle: { drawn, label, placement }, isDraft }: PlanRectangleProps) {
  return (
    <g className={isDraft ? 'plan-aisle plan-aisle-draft' : 'plan-aisle'}>
      <rect x={drawn.x} y={drawn.y} width={drawn.width} height={drawn.height} vectorEffect="non-scaling-stroke" />
      <PlanLabel placement={placement} label={label} />
    </g>
  );
}

function PlanLabel({ placement, label }: { readonly placement: LabelPlacement; readonly label: string }) {
  const { x, y, fontSize, anchor, baseline } = placement;
  return (
    <text className={placement.kind === 'beside' ? 'plan-label-beside' : undefined} x={x} y={y} fontSize={fontSize} textAnchor={anchor} dominantBaseline={baseline}>
      {label}
    </text>
  );
}
