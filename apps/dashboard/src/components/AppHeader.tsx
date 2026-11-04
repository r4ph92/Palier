import { useText } from '../i18n/LanguageContext.tsx';
import { useSignOut } from '../session/useSignOut.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { LanguageToggle } from './LanguageToggle.tsx';

// The product name, the same in both languages; each page names itself in its own eyebrow.
const WORDMARK = 'Palier';

interface AppHeaderProps {
  readonly onSignOut: (() => Promise<void>) | null;
}

export function AppHeader({ onSignOut }: AppHeaderProps) {
  const text = useText();
  return (
    <header className="app-header">
      <a href="#content" className="skip-link">
        {text.app.skipToContent}
      </a>
      <p className="wordmark" lang="fr">
        {WORDMARK}
      </p>
      <nav className="app-actions" aria-label={text.app.name}>
        <LanguageToggle />
        {onSignOut === null ? null : <SignOutButton onSignOut={onSignOut} />}
      </nav>
    </header>
  );
}

function SignOutButton({ onSignOut }: { readonly onSignOut: () => Promise<void> }) {
  const text = useText();
  const { pending, error, signOut } = useSignOut(onSignOut);
  return (
    <>
      <button type="button" className="text-button" onClick={signOut} aria-disabled={pending}>
        {pending ? text.app.signingOut : text.app.signOut}
      </button>
      {error === null ? null : <ErrorNotice code={error} takesFocus />}
    </>
  );
}
