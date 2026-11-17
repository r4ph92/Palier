import type { frExits } from './frExits.ts';

export const enExits: typeof frExits = {
  title: 'Exits',
  unavailableTitle: 'Exits unavailable',
  back: 'Back to the parking lot',
  summary: 'Exits in 30 days: %{count}',
  hint: 'Share of exits by how the vehicle was identified. A high “Beacon” share means gesture-free exit works in your lot.',
  listLabel: 'Exits by identification method',
  empty: 'No exits in 30 days',
  methods: { BEACON: 'Beacon', APP: 'App', PLATE: 'Plate', TRANSPONDER: 'Transponder', STAFF: 'Staff' },
};
