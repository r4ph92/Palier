import type { FastifyReply, FastifyRequest } from 'fastify';
import { sessionLifetimeSeconds } from '../../domain/sessions/sessionTokens.ts';

export const DASHBOARD_COOKIE = 'palier_dashboard';
const DASHBOARD_COOKIE_PATH = '/v1/dashboard';

// HttpOnly keeps the token away from page scripts; SameSite=Strict and the path keep it off every other request.
function cookieOptions(secure: boolean, maxAge: number) {
  return { httpOnly: true, sameSite: 'strict', path: DASHBOARD_COOKIE_PATH, secure, maxAge } as const;
}

export function setDashboardCookie(reply: FastifyReply, token: string, secure: boolean): void {
  void reply.setCookie(DASHBOARD_COOKIE, token, cookieOptions(secure, sessionLifetimeSeconds('DASHBOARD')));
}

export function clearDashboardCookie(reply: FastifyReply, secure: boolean): void {
  void reply.setCookie(DASHBOARD_COOKIE, '', cookieOptions(secure, 0));
}

export function dashboardCookieToken(request: FastifyRequest): string | null {
  const token = request.cookies[DASHBOARD_COOKIE];
  return token === undefined || token === '' ? null : token;
}
