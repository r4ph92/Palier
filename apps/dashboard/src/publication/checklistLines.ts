import type { Attestation, LotPublication, MissingPrerequisiteCode, PublicationGate } from '@palier/shared-types';
import { formatMoney } from '@palier/shared-types/money';
import { formatCalendarDay, formatRecentDateTime } from '../i18n/formatNumbers.ts';
import type { Dictionary } from '../i18n/fr.ts';
import { interpolate } from '../i18n/interpolate.ts';
import type { Language } from '../i18n/LanguageContext.tsx';
import { pluralOf } from '../i18n/plural.ts';

export interface ChecklistLine {
  readonly key: string;
  readonly name: string;
  readonly isMet: boolean;
  readonly detail: string;
}

export interface ChecklistWording {
  readonly text: Dictionary;
  readonly language: Language;
  readonly now: Date;
}

type LotLine = Omit<ChecklistLine, 'isMet'> & { readonly code: MissingPrerequisiteCode };

// The lines in the API's order; a line is met exactly when the API does not list it as missing.
export function checklistLinesOf(publication: LotPublication, wording: ChecklistWording): ChecklistLine[] {
  const missingCodes = new Set(publication.missing.map(({ code }) => code));
  const lotLines = [...lotLinesOf(publication, wording), ...absentGateLinesOf(missingCodes, wording.text)];
  const lines = lotLines.map(({ code, ...line }) => ({ ...line, isMet: !missingCodes.has(code) }));
  return [...lines, ...publication.gates.map((gate) => gateLineOf(gate, wording))];
}

function lotLinesOf(publication: LotPublication, { text, language }: ChecklistWording): LotLine[] {
  const words = text.publication;
  const { dailyCapCents } = publication.pricing;
  return [
    { code: 'STRIPE_NOT_VERIFIED', key: 'stripe', name: words.stripeName, detail: interpolate(words.stripeDetail, { state: text.kycStatus[publication.stripe.kycStatus] }) },
    { code: 'PRICING_MISSING', key: 'pricing', name: words.pricingName, detail: dailyCapCents === null ? words.noPricing : interpolate(words.pricingDetail, { amount: formatMoney(dailyCapCents, language) }) },
    { code: 'CAPACITY_ZERO', key: 'capacity', name: words.capacityName, detail: pluralOf(words.capacityDetail, publication.spots.capacity, language) },
    { code: 'NO_SPOT_IN_SERVICE', key: 'spots', name: words.spotsName, detail: pluralOf(words.spotsDetail, publication.spots.inServiceCount, language) },
    { code: 'WIFI_NOT_ATTESTED', key: 'wifi', name: words.wifiName, detail: measuredDetailOf(publication.wifi, { text, language }) },
    { code: 'CELLULAR_NOT_ATTESTED', key: 'cellular', name: words.cellularName, detail: measuredDetailOf(publication.cellular, { text, language }) },
  ];
}

function measuredDetailOf(attestation: Attestation | null, { text, language }: Omit<ChecklistWording, 'now'>): string {
  if (attestation === null) {
    return text.publication.notMeasured;
  }
  return interpolate(text.publication.measuredDetail, { day: formatCalendarDay(attestation.measuredOn, language), note: attestation.note });
}

// A missing entry or exit gate has no gate to list: it gets a line of its own, shown only while it is missing.
function absentGateLinesOf(missingCodes: ReadonlySet<MissingPrerequisiteCode>, text: Dictionary): LotLine[] {
  const words = text.publication;
  const lines: LotLine[] = [
    { code: 'ENTRY_GATE_MISSING', key: 'entry-gate', name: words.entryGateName, detail: words.noEntryGate },
    { code: 'EXIT_GATE_MISSING', key: 'exit-gate', name: words.exitGateName, detail: words.noExitGate },
  ];
  return lines.filter(({ code }) => missingCodes.has(code));
}

function gateLineOf(gate: PublicationGate, { text, language, now }: ChecklistWording): ChecklistLine {
  const words = text.publication;
  const name = interpolate(words.gateName, { kind: text.equipment.kinds[gate.kind], name: gate.name });
  const detail = gate.verifiedAt === null ? words.gateUnverified : interpolate(words.gateVerified, { time: formatRecentDateTime(new Date(gate.verifiedAt), language, now) });
  return { key: `gate-${gate.id}`, name, isMet: gate.verifiedAt !== null, detail };
}

// « Il manque : … » names what is still missing, in the checklist's order.
export function missingNamesOf(lines: readonly ChecklistLine[], language: Language): string {
  const names = lines.filter(({ isMet }) => !isMet).map(({ name }) => name);
  return new Intl.ListFormat(language === 'fr' ? 'fr-CA' : 'en', { type: 'conjunction' }).format(names);
}
