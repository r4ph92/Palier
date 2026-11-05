import type { LotSummary } from '@palier/shared-types';
import { i18n } from '../i18n/i18n';
import type { SpotHoldController } from '../spotHolds/useSpotHold';
import { TextButton } from './TextButton';

interface SpotHoldButtonProps {
  readonly lot: LotSummary;
  readonly spotHold: SpotHoldController;
  readonly onHeld: () => void;
}

// Hidden once the driver holds a spot (one per driver) and for a full lot; every button waits while one request runs.
export function SpotHoldButton({ lot, spotHold, onHeld }: SpotHoldButtonProps) {
  if (spotHold.held !== null || lot.freeSpots === 0) {
    return null;
  }
  const label = i18n.t('spotHold.hold');
  return (
    <TextButton
      label={label}
      busyLabel={spotHold.requestedLotId === lot.id ? i18n.t('spotHold.holding') : label}
      isBusy={spotHold.requestedLotId !== null}
      accessibilityLabel={i18n.t('spotHold.holdAccessibilityLabel', { lotName: lot.name })}
      align="start"
      onPress={() => spotHold.hold(lot.id, onHeld)}
    />
  );
}
