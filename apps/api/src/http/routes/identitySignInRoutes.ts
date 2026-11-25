import type { SignInResponse } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { IdentityProvider, IdentityRepository, IdentityTokenVerifier } from '../../domain/identity/Identity.ts';
import { signInWithIdentity } from '../../domain/identity/signInWithIdentity.ts';
import type { SessionAccess } from '../../domain/sessions/sessionTokens.ts';
import { appleSignInBodySchema, googleSignInBodySchema, signInResponseSchema } from '../schemas/driverSchemas.ts';
import type { SetupLimiter } from '../SetupLimiter.ts';
import { createSignInLimiter, refuseTooManySignIns } from '../signInLimit.ts';

const UNAUTHORIZED = 401;
const SERVICE_UNAVAILABLE = 503;

export interface IdentitySignInServices {
  readonly verifier: IdentityTokenVerifier;
  readonly identities: IdentityRepository;
}

interface IdentitySignInRequest {
  readonly Body: { readonly identityToken: string; readonly firstName?: string; readonly lastName?: string };
}

interface RouteContext {
  readonly access: SessionAccess;
  readonly services: IdentitySignInServices | undefined;
  readonly limiter: SetupLimiter;
}

// Open routes: the person has no Palier token yet. The provider's signed token is the only proof accepted.
export function registerIdentitySignInRoutes(server: FastifyInstance, access: SessionAccess, services: IdentitySignInServices | undefined): void {
  // One limiter for both providers, so switching provider does not double an address's attempts.
  const context: RouteContext = { access, services, limiter: createSignInLimiter() };
  server.post<IdentitySignInRequest>(
    '/v1/sign-in/apple',
    { schema: { body: appleSignInBodySchema, response: { 200: signInResponseSchema } } },
    signInWith('APPLE', context),
  );
  server.post<IdentitySignInRequest>(
    '/v1/sign-in/google',
    { schema: { body: googleSignInBodySchema, response: { 200: signInResponseSchema } } },
    signInWith('GOOGLE', context),
  );
}

function signInWith(provider: IdentityProvider, { access, services, limiter }: RouteContext) {
  return async (request: FastifyRequest<IdentitySignInRequest>, reply: FastifyReply): Promise<SignInResponse | FastifyReply> => {
    if (!limiter.allow(request.ip)) {
      return refuseTooManySignIns(reply);
    }
    if (services === undefined || !services.verifier.accepts(provider)) {
      return refuseUnavailable(reply);
    }
    const { identityToken, firstName, lastName } = request.body;
    const signedIn = await signInWithIdentity({ ...services, access }, { provider, identityToken, name: { firstName, lastName } });
    if (signedIn === null) {
      return reply.status(UNAUTHORIZED).send({ statusCode: UNAUTHORIZED, error: 'Unauthorized', message: 'The identity token was refused.' });
    }
    return { token: signedIn.token, driver: { id: signedIn.driver.id, firstName: signedIn.driver.firstName } };
  };
}

function refuseUnavailable(reply: FastifyReply): FastifyReply {
  return reply.status(SERVICE_UNAVAILABLE).send({ statusCode: SERVICE_UNAVAILABLE, error: 'SIGN_IN_UNAVAILABLE', message: 'This sign-in provider is not configured.' });
}
