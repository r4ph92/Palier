import { describe, expect, it } from 'vitest';
import { parseEntryLoadArguments } from '../../src/load/entryLoadArguments.ts';
import { seededEntryGate } from '../../src/load/entryLoadTarget.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';

describe('parseEntryLoadArguments', () => {
  it('fires the 20 load-test drivers at Entrée Démo on the local API of PORT, latency unchecked, by default', () => {
    const options = parseEntryLoadArguments([], { PORT: '3042' });

    expect(options).toEqual({ apiUrl: new URL('http://127.0.0.1:3042'), drivers: 20, gateName: 'Entrée Démo', maxLatencyMilliseconds: null });
  });

  it('reads the three-driver run with its latency bound (AC2)', () => {
    const options = parseEntryLoadArguments(['--drivers', '3', '--max-latency-ms', '3000', '--api', 'http://localhost:3042'], {});

    expect(options).toMatchObject({ apiUrl: new URL('http://localhost:3042'), drivers: 3, maxLatencyMilliseconds: 3000 });
  });

  it.each(['http://192.168.1.20:3000', 'https://api.palier.app', 'http://127.0.0.1.example.com:3000'])('refuses an API off this machine: %s', (api) => {
    expect(() => parseEntryLoadArguments(['--api', api], {})).toThrow(/must point at this machine/);
  });

  it.each(['ftp://127.0.0.1', 'not a url'])('refuses an API that is not an http address: %s', (api) => {
    expect(() => parseEntryLoadArguments(['--api', api], {})).toThrow(/must be an http\(s\) address/);
  });

  it.each(['0', '21', '2.5', 'many'])('refuses --drivers %s, outside the 20 seeded drivers', (drivers) => {
    expect(() => parseEntryLoadArguments(['--drivers', drivers], {})).toThrow(/--drivers must be a whole number from 1 to 20/);
  });

  it.each(['0', '-5', 'fast'])('refuses --max-latency-ms %s', (latency) => {
    expect(() => parseEntryLoadArguments([`--max-latency-ms=${latency}`], {})).toThrow(/--max-latency-ms must be a positive whole number/);
  });
});

describe('seededEntryGate', () => {
  it('sends the QR printed on Entrée Démo, for Parking Démo', () => {
    const target = seededEntryGate('Entrée Démo');

    expect(target.lotId).toBe(PARKING_DEMO_ID);
    expect(target.qrContent).toMatch(/^https:\/\/palier\.app\/q\/palier1\.00000000-0000-4000-8000-000000000701\./);
  });

  it.each(['Sortie Démo', 'Entrée Inconnue'])('refuses %s, which is not a seeded entry gate', (gateName) => {
    expect(() => seededEntryGate(gateName)).toThrow(/is not a seeded entry gate/);
  });
});
