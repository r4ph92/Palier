import { formatMoney } from '@palier/shared-types/money';
import type { TimelineDetails, TimelineEntry, TimelineKind } from '@palier/shared-types/sessionTimeline';
import type { ReactNode } from 'react';
import { FilledTemplate } from '../components/FilledTemplate.tsx';
import type { Dictionary } from '../i18n/fr.ts';
import { interpolate } from '../i18n/interpolate.ts';
import type { Language } from '../i18n/LanguageContext.tsx';

type Steps = Dictionary['sessions']['steps'];

export interface TimelineWording {
  readonly steps: Steps;
  readonly language: Language;
}

export interface TimelineLine {
  readonly key: string;
  readonly occurredAt: string;
  readonly label: ReactNode;
}

type LabelOf = (wording: TimelineWording, details: TimelineDetails) => ReactNode;

function amountLabel(template: string, cents: number, language: Language): ReactNode {
  return <FilledTemplate template={template} values={{ amount: <span className="figure">{formatMoney(cents, language)}</span> }} />;
}

const LABELS: Readonly<Record<TimelineKind, LabelOf>> = {
  ENTRY_SCANNED: ({ steps }) => steps.ENTRY_SCANNED,
  GATE_OPENED: ({ steps }, { direction }) => steps.GATE_OPENED[direction ?? 'unknown'],
  ENTRY_LOOP_CLOSED: ({ steps }) => steps.ENTRY_LOOP_CLOSED,
  AISLE_DETECTED: ({ steps }, { aisleCode, isAssignedAisle }) => {
    if (aisleCode === undefined) {
      return steps.AISLE_DETECTED.unknown;
    }
    return interpolate(isAssignedAisle === false ? steps.AISLE_DETECTED.other : steps.AISLE_DETECTED.assigned, { aisle: aisleCode });
  },
  PARKING_PRESUMED: ({ steps }, { evidence }) => steps.PARKING_PRESUMED[evidence ?? 'unknown'],
  PARKING_CONFIRMED: ({ steps }) => steps.PARKING_CONFIRMED,
  ENTRY_CANCELLED: ({ steps }, { reason }) => steps.ENTRY_CANCELLED[reason ?? 'unknown'],
  EXIT_IDENTIFIED: ({ steps }, { method }) => steps.EXIT_IDENTIFIED[method ?? 'unknown'],
  CAPTURED: ({ steps, language }, { amountCents }) =>
    amountCents === undefined ? steps.CAPTURED.unknown : amountLabel(steps.CAPTURED.amount, amountCents, language),
  CAPTURE_PENDING: ({ steps, language }, { amountCents }) =>
    amountCents === undefined ? steps.CAPTURE_PENDING.unknown : amountLabel(steps.CAPTURE_PENDING.amount, amountCents, language),
  EXIT_LOOP_CLOSED: ({ steps }) => steps.EXIT_LOOP_CLOSED,
  PRESENCE_CONFIRMED: ({ steps }) => steps.PRESENCE_CONFIRMED,
  UNKNOWN: ({ steps }) => steps.UNKNOWN,
};

// A capture that left a balance unpaid reads as two lines at the same instant: what was paid, then what was refused.
export function timelineLinesOf({ step, kind, occurredAt, details }: TimelineEntry, wording: TimelineWording): TimelineLine[] {
  const main = { key: String(step), occurredAt, label: LABELS[kind](wording, details) };
  if (kind !== 'CAPTURED' || details.unpaidCents === undefined || details.unpaidCents === 0) {
    return [main];
  }
  return [main, { key: `${step}-unpaid`, occurredAt, label: amountLabel(wording.steps.UNPAID, details.unpaidCents, wording.language) }];
}
