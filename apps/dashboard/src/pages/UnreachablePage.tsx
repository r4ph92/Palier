import { PageHeader } from '../components/PageHeader.tsx';
import { useText } from '../i18n/LanguageContext.tsx';

export function UnreachablePage({ onRetry }: { readonly onRetry: () => Promise<void> }) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.failure.eyebrow} title={text.failure.title} />
      <p className="lead">{text.errors.UNKNOWN}</p>
      <button type="button" className="primary-button" onClick={() => void onRetry()}>
        {text.failure.retry}
      </button>
    </>
  );
}
