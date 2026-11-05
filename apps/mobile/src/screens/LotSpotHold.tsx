import type { LotSummary } from '@palier/shared-types';
import { View } from 'react-native';
import { SpotHoldButton } from '../components/SpotHoldButton';
import type { SpotHoldController } from '../spotHolds/useSpotHold';
import { SpotHoldProblem } from './SpotHoldProblem';

interface LotSpotHoldProps {
  readonly lot: LotSummary;
  readonly spotHold: SpotHoldController;
  readonly onHeld: () => void;
}

// A refused hold is told right under the button that asked, where the driver is looking, even far down the list.
export function LotSpotHold({ lot, spotHold, onHeld }: LotSpotHoldProps) {
  const failure = spotHold.failure?.lotId === lot.id ? spotHold.failure : null;
  return (
    <View testID={`lot-spot-hold-${lot.id}`}>
      <SpotHoldButton lot={lot} spotHold={spotHold} onHeld={onHeld} />
      {failure === null ? null : <SpotHoldProblem failure={failure} onAnnounced={spotHold.acknowledgeFreshFailure} />}
    </View>
  );
}
