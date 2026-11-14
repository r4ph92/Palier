import type { frEquipment } from './frEquipment.ts';

export const enEquipment: typeof frEquipment = {
  title: 'Equipment',
  back: 'Back to the parking lot',
  unavailableTitle: 'Equipment unavailable',
  gatesTitle: 'Terminals',
  gatesIntro: 'A terminal with no signal for more than %{minutes} minutes is silent. A silent entry terminal refuses entries until it is back.',
  noGates: 'No terminals are installed in this parking lot.',
  nameColumn: 'Terminal',
  kindColumn: 'Direction',
  stateColumn: 'State',
  kinds: { ENTRY: 'Entry', EXIT: 'Exit' },
  online: 'Online',
  silentSince: 'Silent since %{time}',
  silentSinceDay: 'Silent since %{day}, %{time}',
  neverHeard: 'No signal received',
  batteriesNote: 'Beacon batteries are tracked with the beacons, on the parking lot map.',
  batteriesLink: 'Map and beacons',
};
