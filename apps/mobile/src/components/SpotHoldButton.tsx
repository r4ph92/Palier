import type { LotSummary } from '@palier/shared-types';
import { i18n } from '../i18n/i18n';
import type { SpotHoldController } from '../spotHolds/useSpotHold';
import { TextButton } from './TextButton';

interface SpotHoldButtonProps {
  readonly lot: LotSummary;
  readonly spotHold: SpotHoldController;
  readonly onHeld: () => void;
}

export function SpotHoldButton({ lot, spotHold, onHeld }: SpotHoldButtonProps) {
  if (spotHold.readState === 'unknown' || spotHold.held !== null || lot.freeSpots === 0) {
    return null;
  }
  const label = i18n.t('spotHold.hold');
  const isRequestedLot = spotHold.requestedLotId === lot.id;
  return (
    <TextButton
      label={label}
      busyLabel={isRequestedLot ? i18n.t('spotHold.holding') : label}
      isBusy={spotHold.requestedLotId !== null}
      accessibilityLabel={i18n.t(isRequestedLot ? 'spotHold.holdingAccessibilityLabel' : 'spotHold.holdAccessibilityLabel', { lotName: lot.name })}
      align="start"
      onPress={() => spotHold.hold(lot.id, onHeld)}
    />
  );
}
