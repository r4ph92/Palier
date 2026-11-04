import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const doc = readFileSync(join(__dirname, '../../../docs/pont-natif.md'), 'utf8');

describe('docs/pont-natif.md', () => {
  it.each([
    'startMonitoring(uuid, major)',
    'stopMonitoring()',
    'keepAlive(until)',
    'flushOfflineQueue()',
    'onAisleChanged(minor, ts)',
    'onLotExit(ts)',
    'onParkedDetected(confidence, ts)',
    'onQueueFlushed(count)',
  ])('lists the signature %s', (signature) => {
    expect(doc).toContain(signature);
  });

  it('explains how iOS and Android honor keepAlive', () => {
    expect(doc).toMatch(/iOS/);
    expect(doc).toMatch(/Android/);
  });
});
