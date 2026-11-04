import type { DashboardUser } from '@palier/shared-types';
import { useState } from 'react';
import { asDashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useResource } from '../api/useResource.ts';
import { ErrorNotice } from '../components/ErrorNotice.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { testSignInClient } from './testSignInClient.ts';
import { testSignInText } from './testSignInText.ts';

interface TestSignInSectionProps {
  readonly onSignedIn: () => Promise<void>;
}

// Shows nothing until the API lists users, and nothing at all when it does not.
export default function TestSignInSection({ onSignedIn }: TestSignInSectionProps) {
  const text = testSignInText[useLanguage().language];
  const users = useResource(testSignInClient.users);
  if (users.status !== 'ready' || users.value.length === 0) {
    return null;
  }
  return (
    <section className="section" aria-labelledby="test-sign-in-title">
      <h2 id="test-sign-in-title" className="section-title">
        {text.title}
      </h2>
      <p className="muted">{text.hint}</p>
      <TestUserList users={users.value} onSignedIn={onSignedIn} />
    </section>
  );
}

async function signInThenRefresh(userId: string, onSignedIn: () => Promise<void>): Promise<DisplayedErrorCode | null> {
  try {
    await testSignInClient.signIn(userId);
    await onSignedIn();
    return null;
  } catch (failure) {
    return asDashboardApiError(failure).code;
  }
}

interface TestSignIn {
  readonly pendingUserId: string | null;
  readonly error: DisplayedErrorCode | null;
  readonly signIn: (userId: string) => Promise<void>;
}

// One sign-in at a time: picks made while one is on its way are ignored, and the rows stay focusable.
function useTestSignIn(onSignedIn: () => Promise<void>): TestSignIn {
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const signIn = async (userId: string) => {
    if (pendingUserId !== null) {
      return;
    }
    setPendingUserId(userId);
    setError(await signInThenRefresh(userId, onSignedIn));
    setPendingUserId(null);
  };
  return { pendingUserId, error, signIn };
}

function TestUserList({ users, onSignedIn }: { readonly users: readonly DashboardUser[] } & TestSignInSectionProps) {
  const { pendingUserId, error, signIn } = useTestSignIn(onSignedIn);
  return (
    <>
      {error === null ? null : <ErrorNotice code={error} takesFocus />}
      <ul className="row-list">
        {users.map((user) => (
          <TestUserRow key={user.id} user={user} pendingUserId={pendingUserId} onPick={(userId) => void signIn(userId)} />
        ))}
      </ul>
    </>
  );
}

interface TestUserRowProps {
  readonly user: DashboardUser;
  readonly pendingUserId: string | null;
  readonly onPick: (userId: string) => void;
}

function TestUserRow({ user, pendingUserId, onPick }: TestUserRowProps) {
  const text = testSignInText[useLanguage().language];
  const isPending = pendingUserId === user.id;
  return (
    <li className="row">
      <button type="button" className="row-button" aria-disabled={pendingUserId !== null} aria-busy={isPending} onClick={() => onPick(user.id)}>
        <span>{`${user.firstName} ${user.lastName}`}</span>
        {isPending ? <span className="muted">{text.signingIn}</span> : null}
      </button>
    </li>
  );
}
