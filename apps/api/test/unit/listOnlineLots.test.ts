import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parkingDemoOnline, repositoryReturning } from './fakes/lotFixtures.ts';

const LIMIT = 50;

function onlineLots(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({ ...parkingDemoOnline(), id: `lot-${index}` }));
}

async function freshListOnlineLots() {
  vi.resetModules();
  return (await import('../../src/domain/lots/listOnlineLots.ts')).listOnlineLots;
}

describe('listOnlineLots', () => {
  let listOnlineLots: Awaited<ReturnType<typeof freshListOnlineLots>>;

  beforeEach(async () => {
    listOnlineLots = await freshListOnlineLots();
  });

  it('asks the repository for one lot more than the limit', async () => {
    const findOnlineLots = vi.fn(() => Promise.resolve([]));

    await listOnlineLots({ findOnlineLots }, { warn: vi.fn() });

    expect(findOnlineLots).toHaveBeenCalledWith(LIMIT + 1);
  });

  it('stays quiet at exactly the limit and under it', async () => {
    const log = { warn: vi.fn() };

    await listOnlineLots(repositoryReturning(onlineLots(LIMIT)), log);
    await listOnlineLots(repositoryReturning(onlineLots(LIMIT - 1)), log);

    expect(log.warn).not.toHaveBeenCalled();
  });

  it('returns at most the limit and warns once when more lots exist', async () => {
    const log = { warn: vi.fn() };

    const lots = await listOnlineLots(repositoryReturning(onlineLots(LIMIT + 1)), log);
    await listOnlineLots(repositoryReturning(onlineLots(LIMIT + 1)), log);

    expect(lots).toHaveLength(LIMIT);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith({ limit: LIMIT }, expect.stringContaining('limit'));
  });
});
