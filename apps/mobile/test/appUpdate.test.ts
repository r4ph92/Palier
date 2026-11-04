import { APP_VERSION_HEADER } from '@palier/shared-types/appVersion';
import appConfig from '../app.config';
import { APP_VERSION, onUpdateRequired, palierFetch } from '../src/api/appUpdate';

describe('palierFetch', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('sends the app version with every request, keeping the headers it was given', async () => {
    await palierFetch('http://localhost:3000/v1/lots', { headers: { Authorization: 'Bearer julie-token' } });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get(APP_VERSION_HEADER)).toBe(APP_VERSION);
    expect(headers.get('Authorization')).toBe('Bearer julie-token');
  });

  it('tells the app when the API answers 426 Update Required', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 426 }));
    const listener = jest.fn();
    const stop = onUpdateRequired(listener);

    await palierFetch('http://localhost:3000/v1/lots');

    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not tell the app about an ordinary answer', async () => {
    const listener = jest.fn();
    const stop = onUpdateRequired(listener);

    await palierFetch('http://localhost:3000/v1/lots');

    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('keeps the app version the same as the one in app.config', () => {
    expect(APP_VERSION).toBe(appConfig.version);
  });
});
