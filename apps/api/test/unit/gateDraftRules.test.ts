import { describe, expect, it } from 'vitest';
import { endpointOf, gateDraftErrors, gateSettingsErrors, type GateDraft } from '@palier/shared-types/gateDraft';

const entreePrincipale: GateDraft = {
  name: 'Entrée principale',
  kind: 'ENTRY',
  integrationKind: 'ACCESS_CONTROL_API',
  endpoint: 'https://controle.garageroy.ca/v2/portes/1',
  reportsLoops: true,
  exitIdentification: 'NONE',
};

describe('the rule for a new gate', () => {
  it('accepts Entrée principale on the access-control API at an https address', () => {
    expect(gateDraftErrors(entreePrincipale)).toEqual({});
  });

  it.each([
    ['a dry contact with no address', { integrationKind: 'DRY_CONTACT', endpoint: null }],
    ['a simulated gate with an https address', { integrationKind: 'SIMULATED', endpoint: 'https://console.palier.test' }],
    ['an address on another port with a query', { endpoint: 'https://10.0.0.5:8443/open?door=1' }],
    ['a 60-character name', { name: 'É'.repeat(60) }],
    ['an exit gate reading plates', { kind: 'EXIT', exitIdentification: 'PLATE' }],
    ['an exit gate reading transponders', { kind: 'EXIT', exitIdentification: 'TRANSPONDER' }],
  ] as const)('accepts %s', (_case, change: Partial<GateDraft>) => {
    expect(gateDraftErrors({ ...entreePrincipale, ...change })).toEqual({});
  });

  it.each([
    ['an http address', { endpoint: 'http://controle.garageroy.ca' }, { endpoint: 'GATE_ENDPOINT_NOT_HTTPS' }],
    ['an ftp address', { endpoint: 'ftp://controle.garageroy.ca' }, { endpoint: 'GATE_ENDPOINT_NOT_HTTPS' }],
    ['a host with no scheme', { endpoint: 'controle.garageroy.ca' }, { endpoint: 'GATE_ENDPOINT_NOT_HTTPS' }],
    ['an address holding a password', { endpoint: 'https://pierre:secret@controle.garageroy.ca' }, { endpoint: 'GATE_ENDPOINT_NOT_HTTPS' }],
    ['an address holding a space', { endpoint: 'https://controle garageroy.ca' }, { endpoint: 'GATE_ENDPOINT_NOT_HTTPS' }],
    ['an address holding a tab', { endpoint: 'https://controle.garageroy.ca/\tportes' }, { endpoint: 'GATE_ENDPOINT_NOT_HTTPS' }],
    ['an address past 2048 characters', { endpoint: `https://a.ca/${'x'.repeat(2036)}` }, { endpoint: 'GATE_ENDPOINT_NOT_HTTPS' }],
    ['the access-control API with no address', { endpoint: null }, { endpoint: 'GATE_ENDPOINT_REQUIRED' }],
    ['a blank name', { name: '  ' }, { name: 'GATE_NAME_REQUIRED' }],
    ['a 61-character name', { name: 'x'.repeat(61) }, { name: 'GATE_NAME_INVALID' }],
    ['a name holding NUL', { name: 'Entrée\u0000Nord' }, { name: 'GATE_NAME_INVALID' }],
    ['an entry gate reading plates', { exitIdentification: 'PLATE' }, { exitIdentification: 'GATE_EXIT_ID_ON_ENTRY' }],
  ] as const)('refuses %s on its own field', (_case, change: Partial<GateDraft>, expected) => {
    expect(gateDraftErrors({ ...entreePrincipale, ...change })).toEqual(expected);
  });

  it('checks the settings of a gate already added without its direction', () => {
    expect(gateSettingsErrors({ ...entreePrincipale, exitIdentification: 'TRANSPONDER', endpoint: 'http://a.ca' })).toEqual({ endpoint: 'GATE_ENDPOINT_NOT_HTTPS' });
  });

  it('reads a blank address as none, and stores a typed one as the URL parser writes it', () => {
    expect(endpointOf('   ')).toBeNull();
    expect(endpointOf(' https://a.ca ')).toBe('https://a.ca/');
    expect(endpointOf('HTTPS://Controle.GarageRoy.ca/Portes')).toBe('https://controle.garageroy.ca/Portes');
  });

  it.each(['https:controle.garageroy.ca', 'https:/controle.garageroy.ca'])('refuses %s, an address without its two slashes before the host', (endpoint) => {
    expect(gateDraftErrors({ ...entreePrincipale, endpoint: endpointOf(endpoint) })).toEqual({ endpoint: 'GATE_ENDPOINT_NOT_HTTPS' });
  });
});
