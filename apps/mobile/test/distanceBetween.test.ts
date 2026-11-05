import { distanceBetween } from '../src/lots/distanceBetween';
import { PARKING_DEMO_LOCATION, PARKING_TEST_PALIERS_LOCATION } from './fakeLotsClient';
import { SIMULATOR_POSITION } from './fakeDeviceLocationClient';

describe('distanceBetween', () => {
  it('is zero from a position to itself', () => {
    expect(distanceBetween(PARKING_DEMO_LOCATION, PARKING_DEMO_LOCATION)).toBe(0);
  });

  it('puts Parking Démo 350 m from the Simulator position', () => {
    expect(distanceBetween(SIMULATOR_POSITION, PARKING_DEMO_LOCATION)).toBe(350);
  });

  it('puts Parking Test Paliers 569 m from the Simulator position', () => {
    expect(distanceBetween(SIMULATOR_POSITION, PARKING_TEST_PALIERS_LOCATION)).toBe(569);
  });

  it('gives the same distance both ways', () => {
    expect(distanceBetween(PARKING_DEMO_LOCATION, SIMULATOR_POSITION)).toBe(distanceBetween(SIMULATOR_POSITION, PARKING_DEMO_LOCATION));
  });

  it('measures one degree of latitude as about 111 km', () => {
    expect(distanceBetween({ latitude: 45, longitude: -73 }, { latitude: 46, longitude: -73 })).toBe(111_195);
  });

  it('measures Montréal to Québec City as about 233 km', () => {
    const montreal = { latitude: 45.5017, longitude: -73.5673 };
    const quebecCity = { latitude: 46.8139, longitude: -71.208 };

    expect(Math.round(distanceBetween(montreal, quebecCity) / 1000)).toBe(233);
  });
});
