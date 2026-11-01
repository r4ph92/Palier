import { APP_VERSION_HEADER, VERSION_PATTERN } from '@palier/shared-types/appVersion';
import type { FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';

const UPDATE_REQUIRED = 426;

// Runs before every route, so an app below the minimum gets the update answer whatever it asks for.
export function requireMinimumAppVersion(minimumVersion: string): onRequestAsyncHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAccepted(request.headers[APP_VERSION_HEADER], minimumVersion)) {
      return reply.status(UPDATE_REQUIRED).send({
        statusCode: UPDATE_REQUIRED,
        error: 'APP_UPDATE_REQUIRED',
        message: 'Update Palier to keep using it.',
      });
    }
  };
}

// A request without a readable version is refused too, so an app older than the header is updated as well.
function isAccepted(version: string | string[] | undefined, minimumVersion: string): boolean {
  return typeof version === 'string' && VERSION_PATTERN.test(version) && compareVersions(version, minimumVersion) >= 0;
}

function compareVersions(version: string, other: string): number {
  const parts = version.split('.').map(Number);
  const otherParts = other.split('.').map(Number);
  const length = Math.max(parts.length, otherParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (parts[index] ?? 0) - (otherParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
