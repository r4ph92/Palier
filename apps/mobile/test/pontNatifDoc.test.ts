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

  it('explains how iOS and Android honor keepAlive in its own section', () => {
    const section = doc.split('### `keepAlive` selon la plateforme')[1]?.split('\n## ')[0] ?? '';

    expect(section).toMatch(/\*\*iOS\*\*/);
    expect(section).toMatch(/\*\*Android\*\*/);
  });
});
