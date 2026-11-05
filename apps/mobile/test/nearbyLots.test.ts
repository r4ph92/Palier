import { NEARBY_RADIUS_METRES, nearbyLots } from '../src/lots/nearbyLots';
import { parkingDemo, parkingTestPaliers } from './fakeLotsClient';
import { SIMULATOR_POSITION } from './fakeDeviceLocationClient';

const parkingDemoWithRoom = parkingDemo(10);
const METRES_PER_DEGREE_OF_LATITUDE = 111_195;

function lotNorthOfSimulatorBy(metres: number, name: string) {
  const latitude = SIMULATOR_POSITION.latitude + metres / METRES_PER_DEGREE_OF_LATITUDE;
  return { ...parkingDemoWithRoom, id: name, name, location: { latitude, longitude: SIMULATOR_POSITION.longitude } };
}

describe('nearbyLots with a position', () => {
  it('lists the lots nearest first with their distance', () => {
    const lots = nearbyLots([parkingTestPaliers, parkingDemoWithRoom], SIMULATOR_POSITION);

    expect(lots.map(({ lot, distanceMetres }) => [lot.name, distanceMetres])).toEqual([
      ['Parking Démo', 350],
      ['Parking Test Paliers', 569],
    ]);
  });

  it('keeps a lot exactly at the radius and drops one beyond it', () => {
    const atRadius = lotNorthOfSimulatorBy(NEARBY_RADIUS_METRES, 'Au rayon');
    const beyond = lotNorthOfSimulatorBy(NEARBY_RADIUS_METRES + 20, 'Au-delà');

    expect(nearbyLots([atRadius, beyond], SIMULATOR_POSITION).map(({ lot }) => lot.name)).toEqual(['Au rayon']);
  });

  it('drops a lot without coordinates', () => {
    const withoutLocation = { ...parkingTestPaliers, location: null };

    expect(nearbyLots([withoutLocation, parkingDemoWithRoom], SIMULATOR_POSITION).map(({ lot }) => lot.name)).toEqual(['Parking Démo']);
  });

  it('keeps a full lot with its distance', () => {
    expect(nearbyLots([parkingDemo(0)], SIMULATOR_POSITION)).toEqual([{ lot: parkingDemo(0), distanceMetres: 350 }]);
  });
});

describe('nearbyLots without a position', () => {
  it('keeps every lot in the order the API gives, by name, without distance', () => {
    const withoutLocation = { ...parkingTestPaliers, location: null };

    expect(nearbyLots([parkingDemoWithRoom, withoutLocation], null)).toEqual([
      { lot: parkingDemoWithRoom, distanceMetres: null },
      { lot: withoutLocation, distanceMetres: null },
    ]);
  });
});
