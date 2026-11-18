import type { TariffPolicy } from '@palier/shared-types';
import { formatMoney } from './formatMoney';
import { currentLanguage, i18n } from './i18n';

// « 0,75 $ / 15 min · plafond 25,00 $ par jour »: the lot list's short form.
export function tariffLine(tariff: TariffPolicy): string {
  return i18n.t('home.tariff', figuresOf(tariff));
}

// « 0,75 $ par 15 min, plafond 25,00 $ par jour »: the tariff the driver accepts before entering.
export function tariffSentence(tariff: TariffPolicy): string {
  return i18n.t('scan.tariff', figuresOf(tariff));
}

// « 25,00 $ seront retenus sur votre carte jusqu’à votre sortie »
export function holdSentence(holdCents: number): string {
  return i18n.t('scan.hold', { amount: formatMoney(holdCents, currentLanguage()) });
}

function figuresOf({ incrementCents, incrementMinutes, dailyCapCents }: TariffPolicy) {
  const language = currentLanguage();
  return { price: formatMoney(incrementCents, language), minutes: incrementMinutes, cap: formatMoney(dailyCapCents, language) };
}
