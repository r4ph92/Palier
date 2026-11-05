import { describe, expect, it, vi } from 'vitest';
import { listOnlineLots, ONLINE_LOTS_LIMIT } from '../../src/domain/lots/listOnlineLots.ts';
import { parkingDemoOnline, repositoryReturning } from './fakes/lotFixtures.ts';

function onlineLots(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({ ...parkingDemoOnline(), id: `lot-${index}` }));
}

describe('listOnlineLots', () => {
  it('asks the repository for at most 50 lots', async () => {
    const findOnlineLots = vi.fn(() => Promise.resolve([]));

    await listOnlineLots({ findOnlineLots }, { warn: vi.fn() });

    expect(findOnlineLots).toHaveBeenCalledWith(50);
  });

  it('warns when the list reaches the limit, since lots past it are left out', async () => {
    const log = { warn: vi.fn() };

    await listOnlineLots(repositoryReturning(onlineLots(ONLINE_LOTS_LIMIT)), log);

    expect(log.warn).toHaveBeenCalledWith({ limit: 50 }, expect.stringContaining('limit'));
  });

  it('stays quiet under the limit', async () => {
    const log = { warn: vi.fn() };

    await listOnlineLots(repositoryReturning(onlineLots(ONLINE_LOTS_LIMIT - 1)), log);

    expect(log.warn).not.toHaveBeenCalled();
  });
});
