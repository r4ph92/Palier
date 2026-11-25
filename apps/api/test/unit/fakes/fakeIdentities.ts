import { randomUUID } from 'node:crypto';
import type { IdentityProvider, IdentityRepository, IdentityTokenVerifier, PersonName, VerifiedIdentity } from '../../../src/domain/identity/Identity.ts';
import type { FakeDriverRepository } from '../fakeDriverRepository.ts';

// Trusts exactly the tokens a test registers, each standing for the identity its provider would vouch for.
export class FakeIdentityTokenVerifier implements IdentityTokenVerifier {
  readonly #tokens = new Map<string, VerifiedIdentity>();
  readonly #providers: ReadonlySet<IdentityProvider>;

  constructor(providers: readonly IdentityProvider[] = ['APPLE', 'GOOGLE']) {
    this.#providers = new Set(providers);
  }

  trust(token: string, identity: VerifiedIdentity): this {
    this.#tokens.set(token, identity);
    return this;
  }

  accepts(provider: IdentityProvider): boolean {
    return this.#providers.has(provider);
  }

  verify(provider: IdentityProvider, identityToken: string): Promise<VerifiedIdentity | null> {
    const identity = this.#tokens.get(identityToken);
    return Promise.resolve(identity?.provider === provider ? identity : null);
  }
}

// Keeps accounts in the driver fake, so a token issued at sign-in opens the driver routes like a real one.
export class FakeIdentityRepository implements IdentityRepository {
  readonly #drivers: FakeDriverRepository;
  readonly #accountsByIdentity = new Map<string, string>();
  readonly #accountsByEmail = new Map<string, string>();

  constructor(drivers: FakeDriverRepository, existingEmails: Readonly<Record<string, string>> = {}) {
    this.#drivers = drivers;
    for (const [email, userId] of Object.entries(existingEmails)) this.#accountsByEmail.set(email, userId);
  }

  get accountCount(): number {
    return new Set(this.#accountsByEmail.values()).size;
  }

  get identityCount(): number {
    return this.#accountsByIdentity.size;
  }

  findOrCreateAccount(identity: VerifiedIdentity, name: PersonName): Promise<string> {
    const key = `${identity.provider}:${identity.subject}`;
    const known = this.#accountsByIdentity.get(key);
    if (known !== undefined) {
      return Promise.resolve(known);
    }
    let userId = this.#accountsByEmail.get(identity.email);
    if (userId === undefined) {
      userId = randomUUID();
      this.#drivers.addDriver({ id: userId, ...name });
      this.#accountsByEmail.set(identity.email, userId);
    }
    this.#accountsByIdentity.set(key, userId);
    return Promise.resolve(userId);
  }
}
