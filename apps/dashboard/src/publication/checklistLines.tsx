import type { Attestation, LotPublication, MissingPrerequisiteCode, PublicationGate } from '@palier/shared-types';
import { formatMoney } from '@palier/shared-types/money';
import { MISSING_PREREQUISITE_CODES } from '@palier/shared-types/publication';
import type { ReactNode } from 'react';
import { CountedText } from '../components/CountedText.tsx';
import { FilledTemplate } from '../components/FilledTemplate.tsx';
import { formatCalendarDay, formatRecentDateTime } from '../i18n/formatNumbers.ts';
import type { Dictionary } from '../i18n/fr.ts';
import { interpolate } from '../i18n/interpolate.ts';
import type { Language } from '../i18n/LanguageContext.tsx';
import { pluralFormOf, type PluralForms } from '../i18n/plural.ts';

export interface ChecklistLine {
  readonly key: string;
  readonly name: string;
  readonly isMet: boolean;
  readonly detail: ReactNode;
}

export interface ChecklistWording {
  readonly text: Dictionary;
  readonly language: Language;
  readonly now: Date;
}

type LotLineCode = Exclude<MissingPrerequisiteCode, 'GATE_UNVERIFIED'>;
type LotLine = Pick<ChecklistLine, 'name' | 'detail'>;
type Wording = Omit<ChecklistWording, 'now'>;

const LOT_LINE_CODES: readonly LotLineCode[] = MISSING_PREREQUISITE_CODES.filter((code): code is LotLineCode => code !== 'GATE_UNVERIFIED');
// A missing entry or exit gate has no gate to list: its line is shown only while it is missing.
const SHOWN_ONLY_WHILE_MISSING: ReadonlySet<MissingPrerequisiteCode> = new Set(['ENTRY_GATE_MISSING', 'EXIT_GATE_MISSING']);

// The lines in the API's order; a line is met exactly when the API does not list it as missing.
export function checklistLinesOf(publication: LotPublication, wording: ChecklistWording): ChecklistLine[] {
  const missingCodes = new Set(publication.missing.map(({ code }) => code));
  const unverifiedGateIds = new Set(publication.missing.filter(({ code }) => code === 'GATE_UNVERIFIED').map(({ gateId }) => gateId));
  const lotLines = lotLinesOf(publication, wording);
  const shownCodes = LOT_LINE_CODES.filter((code) => missingCodes.has(code) || !SHOWN_ONLY_WHILE_MISSING.has(code));
  const lines = shownCodes.map((code) => ({ key: code, ...lotLines[code], isMet: !missingCodes.has(code) }));
  return [...lines, ...publication.gates.map((gate) => gateLineOf(gate, !unverifiedGateIds.has(gate.id), wording))];
}

function lotLinesOf(publication: LotPublication, { text, language }: Wording): Readonly<Record<LotLineCode, LotLine>> {
  const words = text.publication;
  return {
    STRIPE_NOT_VERIFIED: { name: words.stripeName, detail: interpolate(words.stripeDetail, { state: text.kycStatus[publication.stripe.kycStatus] }) },
    PRICING_MISSING: { name: words.pricingName, detail: pricingDetailOf(publication.pricing.dailyCapCents, { text, language }) },
    CAPACITY_ZERO: { name: words.capacityName, detail: countDetailOf(words.capacityDetail, publication.spots.capacity, language) },
    NO_SPOT_IN_SERVICE: { name: words.spotsName, detail: countDetailOf(words.spotsDetail, publication.spots.inServiceCount, language) },
    WIFI_NOT_ATTESTED: { name: words.wifiName, detail: measuredDetailOf(publication.wifi, { text, language }) },
    CELLULAR_NOT_ATTESTED: { name: words.cellularName, detail: measuredDetailOf(publication.cellular, { text, language }) },
    ENTRY_GATE_MISSING: { name: words.entryGateName, detail: words.noEntryGate },
    EXIT_GATE_MISSING: { name: words.exitGateName, detail: words.noExitGate },
  };
}

function pricingDetailOf(dailyCapCents: number | null, { text, language }: Wording): ReactNode {
  if (dailyCapCents === null) {
    return text.publication.noPricing;
  }
  return <FilledTemplate template={text.publication.pricingDetail} values={{ amount: <Figure>{formatMoney(dailyCapCents, language)}</Figure> }} />;
}

function countDetailOf(forms: PluralForms, count: number, language: Language): ReactNode {
  return <CountedText template={pluralFormOf(forms, count, language)} count={count} />;
}

function measuredDetailOf(attestation: Attestation | null, { text, language }: Wording): ReactNode {
  if (attestation === null) {
    return text.publication.notMeasured;
  }
  const day = <Figure>{formatCalendarDay(attestation.measuredOn, language)}</Figure>;
  return <FilledTemplate template={text.publication.measuredDetail} values={{ day, note: attestation.note }} />;
}

function gateLineOf(gate: PublicationGate, isMet: boolean, { text, language, now }: ChecklistWording): ChecklistLine {
  const words = text.publication;
  const name = interpolate(words.gateName, { kind: text.equipment.kinds[gate.kind], name: gate.name });
  const time = gate.verifiedAt === null ? null : <Figure>{formatRecentDateTime(new Date(gate.verifiedAt), language, now)}</Figure>;
  const detail = time === null ? words.gateUnverified : <FilledTemplate template={words.gateVerified} values={{ time }} />;
  return { key: `gate-${gate.id}`, name, isMet, detail };
}

// The whole amount, day or time in mono, separators included (design.md, signature move 3).
function Figure({ children }: { readonly children: string }) {
  return <span className="figure">{children}</span>;
}

// « Il manque : … » names what is still missing, in the checklist's order.
export function missingNamesOf(lines: readonly ChecklistLine[], language: Language): string {
  const names = lines.filter(({ isMet }) => !isMet).map(({ name }) => name);
  return new Intl.ListFormat(language === 'fr' ? 'fr-CA' : 'en', { type: 'conjunction' }).format(names);
}
