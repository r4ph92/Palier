import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { gateQrLink, signGateToken } from '../../src/domain/entries/gateToken.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie } from './fakeDriverRepository.ts';
import { ENTREE_DEMO_SECRET, entreeDemoGate } from './fakes/entryFakes.ts';

const token = signGateToken(entreeDemoGate.id, ENTREE_DEMO_SECRET);
const entreeDemoQr = gateQrLink(entreeDemoGate.id, ENTREE_DEMO_SECRET);

describe('POST /v1/entries with hostile QR content', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function startWithJulieReady() {
    const configured = configureServer();
    server = configured.server;
    await acceptNoticeAs(configured.driverRepository, julie);
    await configured.vehicleRepository.saveVehicle(julie.id, { plate: 'ABC 123', plateKey: 'ABC123', province: 'QC' });
    await configured.driverRepository.saveStripeCustomerIdIfMissing(julie.id, 'cus_Julie');
    await configured.driverRepository.saveSavedCard(julie.id, 'pm_Julie', { brand: 'visa', last4: '4242' });
    const headers = await authorizationFor(configured.driverRepository, julie);
    const enter = (qrContent: string) => server.inject({ method: 'POST', url: '/v1/entries', headers, payload: { qrContent } });
    return { ...configured, enter };
  }

  it.each([
    ['the link over plain http', `http://palier.app/q/${token}`],
    ['the link without its scheme', `palier.app/q/${token}`],
    ['the link on a look-alike host', `https://palier.app.evil.test/q/${token}`],
    ['the link with a query string', `${entreeDemoQr}?utm=1`],
    ['the link with a trailing slash', `${entreeDemoQr}/`],
    ['the link with a fragment', `${entreeDemoQr}#x`],
    ['the link pasted twice', `${entreeDemoQr}${entreeDemoQr}`],
    ['the token with a zero-width space inside', `${token.slice(0, 20)}\u200B${token.slice(20)}`],
    ['the token with a line break inside', `${token.slice(0, 20)}\n${token.slice(20)}`],
    ['an SQL fragment', `palier1.${entreeDemoGate.id}.' OR '1'='1`],
    ['a script tag', '<script>alert(1)</script>'],
    ['only spaces', '     '],
    ['accents and emoji', 'Entrée Démo 🚗'],
  ])('refuses %s with QR_NOT_RECOGNIZED and writes nothing', async (_case, qrContent) => {
    const { enter, entries } = await startWithJulieReady();

    const response = await enter(qrContent);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'QR_NOT_RECOGNIZED' });
    expect(entries.journal).toEqual([]);
    expect(entries.payments.authorized).toEqual([]);
    expect(entries.gateCommander.opened).toEqual([]);
  });

  it('does not echo the pasted content back in the refusal', async () => {
    const { enter } = await startWithJulieReady();

    const response = await enter('<script>alert(1)</script>');

    expect(response.body).not.toContain('<script>');
  });

  it.each([
    ['spaces and a tab around the link', ` \t${entreeDemoQr}  `],
    ['a line break after the link', `${entreeDemoQr}\n`],
    ['no-break spaces around the bare token', `\u00A0${token}\u00A0`],
  ])('admits Julie when the QR comes with %s', async (_case, qrContent) => {
    const { enter } = await startWithJulieReady();

    expect((await enter(qrContent)).statusCode).toBe(201);
  });
});
