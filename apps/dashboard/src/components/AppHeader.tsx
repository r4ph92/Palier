import type { ReactNode } from 'react';
import { useText } from '../i18n/LanguageContext.tsx';
import { useSignOut } from '../session/useSignOut.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { LanguageToggle } from './LanguageToggle.tsx';

// The product name, the same in both languages; each page names itself in its own eyebrow.
const WORDMARK = 'Palier';

interface AppHeaderProps {
  readonly onSignOut: (() => Promise<void>) | null;
}

// One component for signed-in and signed-out, so the language toggle is not remounted when the session loads.
export function AppHeader({ onSignOut }: AppHeaderProps) {
  const text = useText();
  const { pending, error, signOut } = useSignOut(onSignOut);
  const button =
    onSignOut === null ? null : (
      <button type="button" className="text-button" onClick={signOut} aria-disabled={pending}>
        {pending ? text.app.signingOut : text.app.signOut}
      </button>
    );
  return <HeaderFrame signOut={button} notice={error === null ? null : <ErrorNotice code={error} takesFocus />} />;
}

interface HeaderFrameProps {
  readonly signOut: ReactNode;
  readonly notice: ReactNode;
}

// The notice sits under the row, outside the nav, so a sign-out failure never reflows the actions.
function HeaderFrame({ signOut, notice }: HeaderFrameProps) {
  const text = useText();
  return (
    <header className="app-header">
      <a href="#content" className="skip-link">
        {text.app.skipToContent}
      </a>
      <div className="app-header-row">
        <p className="wordmark" lang="fr">
          {WORDMARK}
        </p>
        <nav className="app-actions" aria-label={text.app.name}>
          <LanguageToggle />
          {signOut}
        </nav>
      </div>
      {notice}
    </header>
  );
}
