import { screen, userEvent } from '@testing-library/react-native';
import type { SupportedLanguage } from '../src/i18n/i18n';
import { julieAtParkingDemo } from './fakeParkingSessionClient';
import { julieWith } from './walkAwayRig';

export const SPOT_TAKEN = 'Place prise';
export const CONFIRM_A1_TAKEN = 'Confirmer que la place A-1 est prise ?';
export const NONE_FREE = 'Aucune autre place libre — garez-vous sur une place libre et indiquez son numéro';

// Julie went through the gate on A-1 and has not parked yet.
export async function julieThroughTheGate(language: SupportedLanguage = 'fr') {
  const rig = await julieWith(julieAtParkingDemo(), language);
  return { ...rig, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync }) };
}

// Julie tapped « Place prise »: the question waits for « Confirmer ».
export async function julieReportingA1() {
  const rig = await julieThroughTheGate();
  await rig.user.press(screen.getByRole('button', { name: SPOT_TAKEN }));
  return rig;
}
