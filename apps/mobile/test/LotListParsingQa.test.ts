import { parseLotList } from '../src/api/parseLotList';
import { PalierUnreachableError } from '../src/api/LotsClient';
import { parkingDemo as parkingDemoWithFreeSpots } from './fakeLotsClient';

const parkingDemo = parkingDemoWithFreeSpots(10);

// GET /v1/lots as the lane API answered Julie Tremblay on the seeded database, a full lot included, with the tariff since #151.
const SEEDED_LOT_LIST_BODY =
  '[{"id":"00000000-0000-4000-8000-000000000201","name":"Parking Démo","freeSpots":10,"capacity":10,' +
  '"freeSpotsByCategory":{"standard":7,"electric":1,"accessible":1,"oversize":1},"location":{"latitude":45.50165,"longitude":-73.5673},' +
  '"tariff":{"incrementCents":75,"incrementMinutes":15,"dailyCapCents":2500}},' +
  '{"id":"00000000-0000-4000-8000-000000000203","name":"Parking Test Paliers","freeSpots":0,"capacity":6,' +
  '"freeSpotsByCategory":{"standard":0,"electric":0,"accessible":0,"oversize":0},"location":{"latitude":45.505,"longitude":-73.56},' +
  '"tariff":{"incrementCents":75,"incrementMinutes":15,"dailyCapCents":2500}}]';

function withCategory(category: string, count: unknown): unknown {
  return { ...parkingDemo, freeSpotsByCategory: { ...parkingDemo.freeSpotsByCategory, [category]: count } };
}

describe('parseLotList against hostile counts', () => {
  it('reads the list the seeded API answers, the full lot included', () => {
    const lots = parseLotList(JSON.parse(SEEDED_LOT_LIST_BODY));

    expect(lots.map(({ name, freeSpots }) => [name, freeSpots])).toEqual([
      ['Parking Démo', 10],
      ['Parking Test Paliers', 0],
    ]);
  });

  it.each([
    ['a free spot count of -1', { ...parkingDemo, freeSpots: -1 }],
    ['a free spot count of -0.5', { ...parkingDemo, freeSpots: -0.5 }],
    ['a free spot count of 0.1', { ...parkingDemo, freeSpots: 0.1 }],
    ['a free spot count of 2^53', { ...parkingDemo, freeSpots: 2 ** 53 }],
    ['a free spot count of 1e300', { ...parkingDemo, freeSpots: 1e300 }],
    ['a free spot count written as text', { ...parkingDemo, freeSpots: '10' }],
    ['a free spot count of "NaN"', { ...parkingDemo, freeSpots: 'NaN' }],
    ['a free spot count of null', { ...parkingDemo, freeSpots: null }],
    ['a free spot count of true', { ...parkingDemo, freeSpots: true }],
    ['a free spot count in an array', { ...parkingDemo, freeSpots: [10] }],
    ['a capacity of -1', { ...parkingDemo, capacity: -1 }],
    ['a capacity of 2.5', { ...parkingDemo, capacity: 2.5 }],
    ['a capacity of 1e300', { ...parkingDemo, capacity: 1e300 }],
    ['a capacity written as text', { ...parkingDemo, capacity: '10' }],
    ['an electric count of -1', withCategory('electric', -1)],
    ['an accessible count of 0.5', withCategory('accessible', 0.5)],
    ['a standard count of 1e300', withCategory('standard', 1e300)],
    ['an oversize count of "NaN"', withCategory('oversize', 'NaN')],
    ['a standard count of null', withCategory('standard', null)],
    ['category counts given as a list', { ...parkingDemo, freeSpotsByCategory: [7, 1, 1, 1] }],
    ['no category counts at all', { ...parkingDemo, freeSpotsByCategory: null }],
  ])('treats a lot with %s as unreadable', (_case, lot) => {
    expect(() => parseLotList([lot])).toThrow(PalierUnreachableError);
  });

  it('treats the whole list as unreadable when one lot of many is wrong', () => {
    const lots = [parkingDemo, { ...parkingDemo, id: 'second', freeSpots: -3 }];

    expect(() => parseLotList(lots)).toThrow(PalierUnreachableError);
  });

  it.each([
    ['NaN', 'NaN'],
    ['an object', { lots: [] }],
    ['null', null],
  ])('treats a body of %s as unreadable', (_case, body) => {
    expect(() => parseLotList(body)).toThrow(PalierUnreachableError);
  });

  it('reads a whole number written with an exponent or a trailing zero, as JSON allows', () => {
    const lots = parseLotList(JSON.parse(`[${JSON.stringify(parkingDemo).replace('"freeSpots":10', '"freeSpots":1e1').replace('"capacity":10', '"capacity":10.0')}]`));

    expect(lots[0]).toMatchObject({ freeSpots: 10, capacity: 10 });
  });
});
