import type { LotPricing } from '@palier/shared-types';
import { formatMoney, NO_BREAK_SPACE } from '@palier/shared-types/money';
import { Fact } from '../components/Fact.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage, useText } from '../i18n/LanguageContext.tsx';
import { pluralOf } from '../i18n/plural.ts';
import type { PricingFormTarget } from '../lotSetup/usePricingForm.ts';
import { PricingForm } from './PricingForm.tsx';

// The minute symbol reads the same in both languages, kept with its number on one line.
function durationOf(minutes: number): string {
  return `${minutes}${NO_BREAK_SPACE}min`;
}

export function PricingSection(target: PricingFormTarget) {
  const text = useText();
  return (
    <section className="section" aria-labelledby="pricing-title">
      <h2 id="pricing-title" className="section-title">
        {text.pricing.title}
      </h2>
      {target.pricing === null ? <p className="muted">{text.pricing.none}</p> : <PricingFacts pricing={target.pricing} />}
      <PricingForm {...target} />
    </section>
  );
}

function PricingFacts({ pricing }: { readonly pricing: LotPricing }) {
  const { text, language } = useLanguage();
  const rate = interpolate(text.pricing.rate, { amount: formatMoney(pricing.incrementCents, language), duration: durationOf(pricing.incrementMinutes) });
  return (
    <dl className="facts">
      <Fact label={text.pricing.rateLabel}>{rate}</Fact>
      <Fact label={text.pricing.dailyCapLabel}>{formatMoney(pricing.dailyCapCents, language)}</Fact>
      <Fact label={text.pricing.holdQuotaLabel}>{pluralOf(text.pricing.holdQuota, pricing.holdQuota, language)}</Fact>
    </dl>
  );
}
