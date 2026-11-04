import { useText } from '../i18n/LanguageContext.tsx';

// Before GET /me answers there is no page yet; the hidden heading still gives the document its h1.
export function LoadingPage() {
  const text = useText();
  return (
    <>
      <h1 className="visually-hidden">{text.app.name}</h1>
      <p role="status" className="muted">
        {text.app.loading}
      </p>
    </>
  );
}
