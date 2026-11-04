import type { FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { DashboardRefusedError } from '../../domain/dashboard/DashboardRefusedError.ts';
import { authenticateDashboardUser } from '../../domain/dashboard/dashboardSessions.ts';
import type { SessionTokenRepository, SessionUser } from '../../domain/sessions/SessionTokenRepository.ts';
import { dashboardCookieToken } from './dashboardSessionCookie.ts';

declare module 'fastify' {
  interface FastifyRequest {
    dashboardUser: SessionUser | null;
  }
}

// Reads the dashboard cookie only: an app bearer token never opens the dashboard.
export function requireDashboardUser(sessions: SessionTokenRepository): onRequestAsyncHookHandler {
  return async (request: FastifyRequest) => {
    const token = dashboardCookieToken(request);
    request.dashboardUser = token === null ? null : await authenticateDashboardUser(sessions, token);
    if (request.dashboardUser === null) {
      throw new DashboardRefusedError('UNAUTHORIZED');
    }
  };
}

export function signedInDashboardUser(request: FastifyRequest): SessionUser {
  if (request.dashboardUser === null) {
    throw new Error('requireDashboardUser must run before this handler.');
  }
  return request.dashboardUser;
}
