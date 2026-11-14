/** @typedef {import('@palier/shared-types').PassageReplayItem} PassageReplayItem */
/** @typedef {{ status: number, body: unknown }} ApiResponse */
/** @typedef {{ issuedAt: string, id: string }} CommandCursor */
/**
 * @typedef {object} GateApi
 * @property {(deviceKey: string) => Promise<ApiResponse>} fetchIdentity
 * @property {(deviceKey: string, gateId: string, closedAt: string) => Promise<ApiResponse>} postPassage
 * @property {(deviceKey: string, gateId: string, passages: readonly PassageReplayItem[]) => Promise<ApiResponse>} replayPassages
 * @property {(deviceKey: string, gateId: string, identifier: string) => Promise<ApiResponse>} postIdentify
 * @property {(deviceKey: string, gateId: string) => Promise<ApiResponse>} postPresence
 * @property {(deviceKey: string, gateId: string) => Promise<ApiResponse>} postHeartbeat
 * @property {(deviceKey: string, after: CommandCursor | null) => Promise<ApiResponse>} fetchCommands
 */

export const UNREACHABLE = 0;
export const OK = 200;

/**
 * @param {typeof fetch} fetchFunction
 * @returns {GateApi}
 */
export function createGateApi(fetchFunction) {
  /** @type {(deviceKey: string, url: string, body: object) => Promise<ApiResponse>} */
  const postJson = (deviceKey, url, body) => {
    const headers = { ...authorization(deviceKey), 'content-type': 'application/json' };
    return request(fetchFunction, url, { method: 'POST', headers, body: JSON.stringify(body) });
  };
  return {
    fetchIdentity: (deviceKey) => request(fetchFunction, '/v1/gates/me', { headers: authorization(deviceKey) }),
    postPassage: (deviceKey, gateId, closedAt) => postJson(deviceKey, gatePath(gateId, 'passage'), { closedAt }),
    replayPassages: (deviceKey, gateId, passages) => postJson(deviceKey, gatePath(gateId, 'passages/replay'), { passages }),
    postIdentify: (deviceKey, gateId, identifier) => postJson(deviceKey, gatePath(gateId, 'identify'), { identifier }),
    postPresence: (deviceKey, gateId) =>
      request(fetchFunction, gatePath(gateId, 'presence'), { method: 'POST', headers: authorization(deviceKey) }),
    postHeartbeat: (deviceKey, gateId) =>
      request(fetchFunction, gatePath(gateId, 'heartbeat'), { method: 'POST', headers: authorization(deviceKey) }),
    fetchCommands: (deviceKey, after) => request(fetchFunction, commandsUrl(after), { headers: authorization(deviceKey) }),
  };
}

/**
 * @param {string} gateId
 * @param {string} action
 * @returns {string}
 */
function gatePath(gateId, action) {
  return `/v1/gates/${encodeURIComponent(gateId)}/${action}`;
}

/**
 * @param {CommandCursor | null} after
 * @returns {string}
 */
function commandsUrl(after) {
  if (after === null) {
    return '/v1/gates/me/commands';
  }
  return `/v1/gates/me/commands?${new URLSearchParams({ after: after.issuedAt, afterId: after.id })}`;
}

/**
 * @param {string} deviceKey
 * @returns {Record<string, string>}
 */
function authorization(deviceKey) {
  return { authorization: `Bearer ${deviceKey}` };
}

/**
 * @param {typeof fetch} fetchFunction
 * @param {string} url
 * @param {RequestInit} init
 * @returns {Promise<ApiResponse>}
 */
async function request(fetchFunction, url, init) {
  const response = await fetchFunction(url, { ...init, cache: 'no-store', credentials: 'omit' }).catch(() => null);
  if (response === null) {
    return { status: UNREACHABLE, body: null };
  }
  return { status: response.status, body: response.ok ? await readJson(response) : null };
}

/**
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
