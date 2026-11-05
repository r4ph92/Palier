import type { LotSummary } from '@palier/shared-types';
import { View } from 'react-native';
import { SpotHoldButton } from '../components/SpotHoldButton';
import type { SpotHoldFailure } from '../spotHolds/spotHoldFailure';
import type { SpotHoldController } from '../spotHolds/useSpotHold';
import { SpotHoldProblem } from './SpotHoldProblem';

interface LotSpotHoldProps {
  readonly lot: LotSummary;
  readonly spotHold: SpotHoldController;
  readonly onHeld: () => void;
}

// A refused hold is told right under the button that asked, where the driver is looking, even far down the list.
export function LotSpotHold({ lot, spotHold, onHeld }: LotSpotHoldProps) {
  const failure = failureUnderLot(spotHold.failure, lot.id);
  return (
    <View testID={`lot-spot-hold-${lot.id}`}>
      <SpotHoldButton lot={lot} spotHold={spotHold} onHeld={onHeld} />
      {failure === null ? null : <SpotHoldProblem failure={failure} onAnnounced={spotHold.acknowledgeFreshFailure} />}
    </View>
  );
}

function failureUnderLot(failure: SpotHoldFailure | null, lotId: string): SpotHoldFailure | null {
  return failure?.target.kind === 'lot' && failure.target.lotId === lotId ? failure : null;
}
