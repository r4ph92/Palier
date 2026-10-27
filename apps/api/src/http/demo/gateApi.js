/** @typedef {{ status: number, body: unknown }} ApiResponse */
/**
 * @typedef {object} GateApi
 * @property {(deviceKey: string) => Promise<ApiResponse>} fetchIdentity
 * @property {(deviceKey: string, gateId: string, closedAt: string) => Promise<ApiResponse>} postPassage
 */

export const UNREACHABLE = 0;

/**
 * @param {typeof fetch} fetchFunction
 * @returns {GateApi}
 */
export function createGateApi(fetchFunction) {
  return {
    fetchIdentity: (deviceKey) => request(fetchFunction, '/v1/gates/me', { headers: authorization(deviceKey) }),
    postPassage: (deviceKey, gateId, closedAt) =>
      request(fetchFunction, `/v1/gates/${encodeURIComponent(gateId)}/passage`, {
        method: 'POST',
        headers: { ...authorization(deviceKey), 'content-type': 'application/json' },
        body: JSON.stringify({ closedAt }),
      }),
  };
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
