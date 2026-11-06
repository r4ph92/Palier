import type { CurrentParkingSession, PlanAisle } from '@palier/shared-types';
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { applyLanguage, type SupportedLanguage } from '../src/i18n/i18n';
import { ParkingGuidance } from '../src/screens/ParkingGuidance';
import { julieAtB3, parkingDemoP1Plan } from './fakeParkingSessionClient';
import { visibleText } from './visibleText';

// The jest preset reports a font scale of 2; the markers sit inside the rectangles at the default size.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

const [aisleA, aisleB] = parkingDemoP1Plan.aisles as [PlanAisle, PlanAisle];

async function showGuidance(currentAisle: PlanAisle | null, session: CurrentParkingSession = julieAtB3(), language: SupportedLanguage = 'fr') {
  applyLanguage(language);
  await render(<ParkingGuidance session={session} currentAisle={currentAisle} />);
}

describe('ParkingGuidance', () => {
  afterEach(() => applyLanguage('fr'));

  it('draws aisles A and B of level P1, B highlighted with spot B-3, under « Rendez-vous allée B, place B-3 »', async () => {
    await showGuidance(null);

    expect(screen.getByText('Rendez-vous allée B, place B-3', visibleText)).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Plan du niveau P1 : allée B en surbrillance, place B-3', ...visibleText })).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-A')).getByText('Allée A')).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-B')).getByText('Allée B')).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-B')).getByText('Place B-3', visibleText)).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-A')).queryByText('Place B-3', visibleText)).toBeNull();
  });

  it('marks the highlighted aisle by a thicker border than the others, not by color alone', async () => {
    await showGuidance(null);

    const borderOf = (code: string) => StyleSheet.flatten(screen.getByTestId(`PlanAisle-${code}`).props.style).borderWidth;
    expect(borderOf('B')).toBeGreaterThan(borderOf('A'));
  });

  it('puts « Vous êtes ici » on aisle A and says the spot is in aisle B', async () => {
    await showGuidance(aisleA);

    expect(screen.getByText('Vous êtes dans l’allée A — votre place est dans l’allée B', visibleText)).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-A')).getByText('Vous êtes ici')).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-B')).queryByText('Vous êtes ici')).toBeNull();
    expect(
      screen.getByRole('image', { name: 'Plan du niveau P1 : allée B en surbrillance, place B-3, vous êtes ici : allée A', ...visibleText }),
    ).toBeOnTheScreen();
  });

  it('says « Vous êtes dans la bonne allée » once in aisle B', async () => {
    await showGuidance(aisleB);

    expect(screen.getByText('Vous êtes dans la bonne allée')).toBeOnTheScreen();
    expect(within(screen.getByTestId('PlanAisle-B')).getByText('Vous êtes ici')).toBeOnTheScreen();
  });

  it('keeps the sentence but draws nothing for a level without rectangles', async () => {
    const undrawn = { ...parkingDemoP1Plan, aisles: parkingDemoP1Plan.aisles.map((aisle) => ({ ...aisle, rectangle: null })) };

    await showGuidance(null, julieAtB3({ levelPlan: undrawn }));

    expect(screen.getByText('Rendez-vous allée B, place B-3', visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('keeps the sentence for a session read without a plan', async () => {
    await showGuidance(null, julieAtB3({ levelPlan: null }));

    expect(screen.getByText('Rendez-vous allée B, place B-3', visibleText)).toBeOnTheScreen();
    expect(screen.queryByTestId('PlanAisle-A')).toBeNull();
  });

  describe('on an English device', () => {
    it('reads « Go to aisle B, spot B-3 »', async () => {
      await showGuidance(null, julieAtB3(), 'en');

      expect(screen.getByText('Go to aisle B, spot B-3', visibleText)).toBeOnTheScreen();
      expect(screen.getByRole('image', { name: 'Plan of level P1: aisle B highlighted, spot B-3', ...visibleText })).toBeOnTheScreen();
      expect(within(screen.getByTestId('PlanAisle-B')).getByText('Spot B-3', visibleText)).toBeOnTheScreen();
    });

    it('reads « You are in aisle A — your spot is in aisle B », then « You are in the right aisle »', async () => {
      await showGuidance(aisleA, julieAtB3(), 'en');
      expect(screen.getByText('You are in aisle A — your spot is in aisle B', visibleText)).toBeOnTheScreen();
      expect(within(screen.getByTestId('PlanAisle-A')).getByText('You are here')).toBeOnTheScreen();

      await showGuidance(aisleB, julieAtB3(), 'en');
      expect(screen.getByText('You are in the right aisle')).toBeOnTheScreen();
    });
  });
});
