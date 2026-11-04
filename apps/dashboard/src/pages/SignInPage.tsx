import { lazy, Suspense } from 'react';
import { PageHeader } from '../components/PageHeader.tsx';
import { useText } from '../i18n/LanguageContext.tsx';

// Only development builds reference the module: a production build drops it, so test sign-in cannot ship.
const TestSignInSection = import.meta.env.DEV ? lazy(() => import('../testSignIn/TestSignInSection.tsx')) : null;

// Three locks: a development build, the VITE_TEST_SIGN_IN flag, and an API that lists test users (it answers 404 in production).
function isTestSignInOffered(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_TEST_SIGN_IN === 'true';
}

interface SignInPageProps {
  readonly onSignedIn: () => Promise<void>;
}

export function SignInPage({ onSignedIn }: SignInPageProps) {
  const text = useText();
  return (
    <>
      <PageHeader eyebrow={text.signIn.eyebrow} title={text.signIn.title} />
      <p className="lead">{text.signIn.providersLater}</p>
      {TestSignInSection !== null && isTestSignInOffered() ? (
        <Suspense fallback={null}>
          <TestSignInSection onSignedIn={onSignedIn} />
        </Suspense>
      ) : null}
    </>
  );
}
