import { AppLink } from '../components/AppLink.tsx';
import { StateMark } from '../components/StateMark.tsx';
import { interpolate } from '../i18n/interpolate.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { pluralFormOf } from '../i18n/plural.ts';
import { equipmentPath } from '../navigation/routes.ts';

interface SilentGatesBannerProps {
  readonly lotId: string;
  readonly gateNames: readonly string[];
}

// Always mounted and empty while every gate answers, so a gate falling silent between two polls is announced.
export function SilentGatesBanner({ lotId, gateNames }: SilentGatesBannerProps) {
  const { text, language } = useLanguage();
  const template = pluralFormOf(text.occupancy.silentGates, gateNames.length, language);
  return (
    <div role="status" className="silent-gates">
      {gateNames.length === 0 ? null : (
        <p className="silent-gates-line">
          <StateMark tone="danger" label={interpolate(template, { names: gateNames.join(', ') })} wraps />{' '}
          <AppLink href={equipmentPath(lotId)} className="text-link">
            {text.occupancy.equipmentLink}
          </AppLink>
        </p>
      )}
    </div>
  );
}
