import type { GeoPosition, LotSummary } from '@palier/shared-types';
import { screen, userEvent } from '@testing-library/react-native';
import { HttpLotsClient } from '../src/api/HttpLotsClient';
import { PalierUnreachableError, type LotsClient } from '../src/api/LotsClient';
import type { DeviceLocationClient, LocationPermission } from '../src/deviceLocation/DeviceLocationClient';
import { distanceBetween } from '../src/lots/distanceBetween';
import { FakeDeviceLocationClient, LOCATION_DENIED_NOTICE_FR, SIMULATOR_POSITION } from './fakeDeviceLocationClient';
import { FakeLotsClient, parkingDemo, parkingTestPaliers } from './fakeLotsClient';
import { renderHomeScreen } from './renderHomeScreen';
import { visibleText } from './visibleText';

function lotNamesInOrder(): string[] {
  return screen.getAllByTestId(/^lot-row-/).map((row) => row.props.accessibilityLabel.split(', ')[0]);
}

function lotAt(name: string, location: GeoPosition | null, freeSpots = 3): LotSummary {
  return { id: `lot-${name}`, name, freeSpots, freeSpotsByCategory: { standard: freeSpots, electric: 0, accessible: 0, oversize: 0 }, location };
}

function metresNorthOf(position: GeoPosition, metres: number): GeoPosition {
  const metresPerDegree = (distanceBetween({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }));
  return { latitude: position.latitude + metres / metresPerDegree, longitude: position.longitude };
}

class ScriptedLocationClient implements DeviceLocationClient {
  permissionRequests = 0;
  permission: LocationPermission = 'granted';
  position: GeoPosition | null = SIMULATOR_POSITION;

  requestWhileInUse(): Promise<LocationPermission> {
    this.permissionRequests += 1;
    return Promise.resolve(this.permission);
  }

  currentPosition(): Promise<GeoPosition | null> {
    return Promise.resolve(this.position);
  }
}

describe('QA #5 the 10 km edge', () => {
  it('keeps a lot just inside 10 km and drops one just outside', async () => {
    const inside = lotAt('Dedans', metresNorthOf(SIMULATOR_POSITION, 9_950));
    const outside = lotAt('Dehors', metresNorthOf(SIMULATOR_POSITION, 10_050));

    await renderHomeScreen(new FakeLotsClient([outside, inside]));

    expect(await screen.findByText('Dedans')).toBeOnTheScreen();
    expect(screen.queryByText('Dehors')).not.toBeOnTheScreen();
    expect(screen.getByText('10 km', visibleText)).toBeOnTheScreen();
  });

  it('says no lot is within 10 km when every lot is further or has no coordinates', async () => {
    const far = lotAt('Loin', { latitude: 46.8139, longitude: -71.208 });

    await renderHomeScreen(new FakeLotsClient([far, lotAt('Sans coordonnées', null)]));

    expect(await screen.findByText('Aucun stationnement en ligne à moins de 10 km.', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText('Loin')).not.toBeOnTheScreen();
  });

  it('keeps the API order between two lots at the same distance', async () => {
    const same = SIMULATOR_POSITION;
    await renderHomeScreen(new FakeLotsClient([lotAt('Alpha', same), lotAt('Bravo', same), lotAt('Charlie', same)]));

    await screen.findByText('Alpha');
    expect(lotNamesInOrder()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('lists many lots nearest first, whatever the API order', async () => {
    const lots = [3_000, 100, 9_000, 1_500, 700].map((metres) => lotAt(`Lot ${metres}`, metresNorthOf(SIMULATOR_POSITION, metres)));

    await renderHomeScreen(new FakeLotsClient(lots));

    await screen.findByText('Lot 100');
    expect(lotNamesInOrder()).toEqual(['Lot 100', 'Lot 700', 'Lot 1500', 'Lot 3000', 'Lot 9000']);
  });
});

describe('QA #5 a device position that is not a number', () => {
  it.each([
    ['NaN', { latitude: NaN, longitude: NaN }],
    ['Infinity', { latitude: Infinity, longitude: 0 }],
  ])('does not hide every lot behind the "nothing within 10 km" message when the position is %s', async (_case, position) => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'fr', new FakeDeviceLocationClient('granted', position));

    expect(await screen.findByText('Parking Démo')).toBeOnTheScreen();
  });
});

describe('QA #5 hostile lot data on the list', () => {
  it('renders markup, a long name, emoji and a blank name as plain text', async () => {
    const lots = [lotAt('<script>alert(1)</script>', SIMULATOR_POSITION), lotAt('Éric & Zoé 🚗 « Garage »', SIMULATOR_POSITION), lotAt('x'.repeat(400), SIMULATOR_POSITION)];

    await renderHomeScreen(new FakeLotsClient(lots));

    expect(await screen.findByText('<script>alert(1)</script>')).toBeOnTheScreen();
    expect(screen.getByText('Éric & Zoé 🚗 « Garage »')).toBeOnTheScreen();
    expect(screen.getByText('x'.repeat(400))).toBeOnTheScreen();
  });

  it('never shows a negative count of free spots', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(-3)]));

    await screen.findByText('Parking Démo');
    expect(screen.queryByText(/-3|−3/)).not.toBeOnTheScreen();
  });

  it('says 1 place libre in the singular and Complet at zero', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(1), lotAt('Vide', SIMULATOR_POSITION, 0)]));

    expect(await screen.findByText('1 place libre', visibleText)).toBeOnTheScreen();
    expect(screen.getByText('Complet')).toBeOnTheScreen();
  });
});

describe('QA #5 the lots parser against malformed API answers', () => {
  const valid = parkingDemo(10);

  function clientAnswering(body: unknown): HttpLotsClient {
    return new HttpLotsClient({ baseUrl: 'http://localhost:3000', fetchFunction: () => Promise.resolve(new Response(JSON.stringify(body), { status: 200 })) });
  }

  it.each([
    ['null', null],
    ['an object', { lots: [valid] }],
    ['a string', 'lots'],
    ['a null entry', [valid, null]],
    ['a lot without categories', [{ ...valid, freeSpotsByCategory: undefined }]],
    ['a lot missing the oversize category', [{ ...valid, freeSpotsByCategory: { standard: 1, electric: 1, accessible: 1 } }]],
    ['a category as a string', [{ ...valid, freeSpotsByCategory: { ...valid.freeSpotsByCategory, standard: '7' } }]],
    ['a category as a decimal', [{ ...valid, freeSpotsByCategory: { ...valid.freeSpotsByCategory, standard: 7.5 } }]],
    ['a count as a string', [{ ...valid, freeSpots: '10' }]],
    ['a count as a decimal', [{ ...valid, freeSpots: 2.5 }]],
    ['a location key missing', [{ ...valid, location: undefined }]],
    ['a latitude without longitude', [{ ...valid, location: { latitude: 45.5 } }]],
    ['coordinates as strings', [{ ...valid, location: { latitude: '45.5', longitude: '-73.5' } }]],
    ['an id as a number', [{ ...valid, id: 7 }]],
  ])('treats %s as unreachable', async (_case, body) => {
    await expect(clientAnswering(body).listLots()).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it.each([
    ['extra fields', [{ ...valid, extra: 'x' }]],
    ['an empty list', []],
    ['a null location', [{ ...valid, location: null }]],
  ])('accepts %s', async (_case, body) => {
    await expect(clientAnswering(body).listLots()).resolves.toBeDefined();
  });

  it('shows the unreachable state, not a crash, when the answer is malformed', async () => {
    const malformed: LotsClient = { listLots: () => clientAnswering([{ ...valid, location: { latitude: 45.5 } }]).listLots() };

    await renderHomeScreen(malformed);

    expect(await screen.findByText('Impossible de joindre Palier.')).toBeOnTheScreen();
  });
});

describe('QA #5 location changes between reads', () => {
  it('shows distances and drops the notice when the driver allows location and pulls to refresh', async () => {
    const location = new ScriptedLocationClient();
    location.permission = 'denied';
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'fr', location);
    expect(await screen.findByText(LOCATION_DENIED_NOTICE_FR)).toBeOnTheScreen();

    location.permission = 'granted';
    await userEvent.setup().pullToRefresh(screen.getByTestId('lot-list'));

    expect(await screen.findByText('350 m', visibleText)).toBeOnTheScreen();
    expect(screen.queryByText(LOCATION_DENIED_NOTICE_FR)).not.toBeOnTheScreen();
  });

  it('shows the notice and drops the distances when the driver turns location off and presses Actualiser', async () => {
    const location = new ScriptedLocationClient();
    await renderHomeScreen(new FakeLotsClient([parkingDemo(10)]), 'fr', location);
    await screen.findByText('350 m', visibleText);

    location.permission = 'denied';
    await userEvent.setup().press(screen.getByRole('button', { name: 'Actualiser' }));

    expect(await screen.findByText(LOCATION_DENIED_NOTICE_FR)).toBeOnTheScreen();
    expect(screen.queryByText('350 m', visibleText)).not.toBeOnTheScreen();
  });

  it('shows the lots sorted by name with the unavailable notice in French when the position cannot be read', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingTestPaliers, parkingDemo(10)]), 'fr', new FakeDeviceLocationClient('granted', null));

    expect(await screen.findByText('Position introuvable : stationnements triés par nom', visibleText)).toBeOnTheScreen();
    expect(lotNamesInOrder()).toEqual(['Parking Test Paliers', 'Parking Démo']);
  });
});

describe('QA #5 English', () => {
  it('writes Full for a lot with no free spot and keeps the distance', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(0)]), 'en');

    expect(await screen.findByText('Full')).toBeOnTheScreen();
    expect(screen.getByText('350 m', visibleText)).toBeOnTheScreen();
  });

  it('writes the empty state with a position in English', async () => {
    await renderHomeScreen(new FakeLotsClient([lotAt('Far', { latitude: 46.8139, longitude: -71.208 })]), 'en');

    expect(await screen.findByText('No parking lot online within 10 km.', visibleText)).toBeOnTheScreen();
  });

  it('does not leave any French word on the English list', async () => {
    await renderHomeScreen(new FakeLotsClient([parkingDemo(2)]), 'en');

    await screen.findByText('Parking Démo');
    const everyText = screen.getAllByText(/./).map((node) => String(node.props.children)).join(' | ');
    expect(everyText).not.toMatch(/Électrique|Grand gabarit|places? libres?|Complet|Actualiser|localisation/);
  });
});
