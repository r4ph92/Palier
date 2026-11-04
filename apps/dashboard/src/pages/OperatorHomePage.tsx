import type { DashboardOperator, KycStatus } from '@palier/shared-types';
import { PageHeader } from '../components/PageHeader.tsx';
import { StateMark, type StateTone } from '../components/StateMark.tsx';
import { useText } from '../i18n/LanguageContext.tsx';
import { LotList } from './LotList.tsx';

// Not started asks for action, pending waits on Stripe, verified can take payments.
const KYC_TONES: Readonly<Record<KycStatus, StateTone>> = {
  NOT_STARTED: 'danger',
  PENDING: 'muted',
  ACTION_REQUIRED: 'danger',
  VERIFIED: 'free',
};

export function OperatorHomePage({ operator }: { readonly operator: DashboardOperator }) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.home.eyebrow} title={operator.legalName} />
      <dl className="facts">
        <div className="fact">
          <dt className="fact-label">{text.home.stripeLabel}</dt>
          <dd className="fact-value">
            <StateMark tone={KYC_TONES[operator.kycStatus]} label={text.kycStatus[operator.kycStatus]} />
          </dd>
        </div>
      </dl>
      <LotList />
    </>
  );
}
