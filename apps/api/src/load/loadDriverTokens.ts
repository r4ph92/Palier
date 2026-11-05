import { signInDriver, signOutDriver } from '../domain/drivers/driverSessions.ts';
import type { SessionAccess } from '../domain/sessions/sessionTokens.ts';

// Tokens are written straight to the database: the test sign-in route only knows the app's personas and limits sign-ins per minute.
export class LoadDriverTokens {
  readonly #access: SessionAccess;
  readonly #tokens: string[] = [];

  constructor(access: SessionAccess) {
    this.#access = access;
  }

  async signIn(driverIds: readonly string[]): Promise<readonly string[]> {
    const newTokens: string[] = [];
    for (const driverId of driverIds) {
      const signedIn = await signInDriver(this.#access, driverId);
      if (signedIn === null) {
        throw new Error(`Load-test driver ${driverId} is not in the database: reseed first (npm run seed --workspace @palier/api).`);
      }
      this.#tokens.push(signedIn.token);
      newTokens.push(signedIn.token);
    }
    return newTokens;
  }

  async revokeAll(): Promise<void> {
    const tokens = this.#tokens.splice(0);
    await Promise.all(tokens.map((token) => signOutDriver(this.#access.sessions, token)));
  }
}
