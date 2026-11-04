import { DASHBOARD_CSRF_HEADER, DASHBOARD_CSRF_VALUE } from '@palier/shared-types/dashboard';
import type { FastifyRequest } from 'fastify';
import { DashboardHttpRefusal } from './DashboardHttpRefusal.ts';

const READ_METHODS = new Set(['GET', 'HEAD']);

// A cross-site form can post with the cookie but cannot add a custom header, so every write must carry it.
export async function requireDashboardWriteHeader(request: FastifyRequest): Promise<void> {
  if (READ_METHODS.has(request.method) || request.headers[DASHBOARD_CSRF_HEADER] === DASHBOARD_CSRF_VALUE) {
    return;
  }
  throw new DashboardHttpRefusal('CSRF_HEADER_MISSING');
}
