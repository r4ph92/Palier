import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { garageRoy, installFakeApi, parkingDemo, pierre, sophie } from './fakeDashboardApi.ts';
import { readyParkingDemo, sortieDemoGate } from './fakePublicationData.ts';
import { checklistLineOf, openPublicationOf, plainText, publicationPathOf, stateWordOf } from './publicationPageSteps.ts';
import { renderDashboard } from './renderDashboard.tsx';

const ONLINE_REQUEST = `PUT /lots/${parkingDemo.id}/online`;

describe('the go-live page', () => {
  it('opens from the lot page and shows Sophie a ready checklist, every line met', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: `/lots/${parkingDemo.id}` });

    await userEvent.click(await screen.findByRole('link', { name: 'Mise en ligne' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Mise en ligne — Parking Démo' })).toBeDefined();
    expect(window.location.pathname).toBe(publicationPathOf(parkingDemo.id));
    expect(screen.getByText('Tous les prérequis sont remplis.')).toBeDefined();
    expect([...document.querySelectorAll('.checklist-line .state-mark')].map((mark) => mark.textContent)).toEqual(Array(8).fill('Rempli'));
    expect(checklistLineOf('Compte Stripe vérifié')).toBe('Compte Stripe vérifié Rempli Vérification Stripe : Vérifié');
    expect(checklistLineOf('Tarif enregistré')).toBe('Tarif enregistré Rempli Plafond journalier : 25,00 $');
    expect(checklistLineOf('Au moins une place en service')).toBe('Au moins une place en service Rempli 9 places en service');
    expect(checklistLineOf('Wi-Fi mesuré sur place')).toBe('Wi-Fi mesuré sur place Rempli Mesuré le 12 novembre 2026 : P1, P2: -62 dBm');
    expect(checklistLineOf('Entrée vérifiée : Entrée Démo')).toBe('Entrée vérifiée : Entrée Démo Rempli Passage de test réussi le 14 nov., 15 h 30');
  });

  it('puts the lot online, then offers to take it offline', async () => {
    const api = await openPublicationOf(sophie, parkingDemo);

    await userEvent.click(screen.getByRole('button', { name: 'Mettre en ligne' }));

    expect(await screen.findByRole('button', { name: 'Mettre hors ligne' })).toBeDefined();
    expect(within(screen.getByRole('region', { name: 'État' })).getByText('En ligne')).toBeDefined();
    expect(api.requests).toContain(ONLINE_REQUEST);
    expect(screen.getByText(/places garanties sont libérées/)).toBeDefined();
  });

  it('takes an online lot offline', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.publication.set(parkingDemo.id, readyParkingDemo({ isOnline: true }));
    renderDashboard({ path: publicationPathOf(parkingDemo.id) });

    await userEvent.click(await screen.findByRole('button', { name: 'Mettre hors ligne' }));

    expect(await screen.findByRole('button', { name: 'Mettre en ligne' })).toBeDefined();
    expect(within(screen.getByRole('region', { name: 'État' })).getByText('Hors ligne')).toBeDefined();
  });

  it('shows Pierre every missing line, names them beside a disabled button, and sends nothing', async () => {
    const api = await openPublicationOf(pierre, garageRoy);

    const button = screen.getByRole('button', { name: 'Mettre en ligne' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(plainText(document.getElementById(button.getAttribute('aria-describedby') ?? ''))).toBe(
      'Il manque : Compte Stripe vérifié, Tarif enregistré, Capacité déclarée, Au moins une place en service, Wi-Fi mesuré sur place, Réseau cellulaire mesuré sur place, Borne d’entrée et Borne de sortie.',
    );
    expect(stateWordOf('Compte Stripe vérifié')).toBe('Manquant');
    expect(checklistLineOf('Compte Stripe vérifié')).toBe('Compte Stripe vérifié Manquant Vérification Stripe : Non commencé');
    expect(checklistLineOf('Tarif enregistré')).toBe('Tarif enregistré Manquant Aucun tarif enregistré');
    expect(checklistLineOf('Capacité déclarée')).toBe('Capacité déclarée Manquant 0 place déclarée');
    expect(checklistLineOf('Borne d’entrée')).toBe('Borne d’entrée Manquant Ajoutez une borne d’entrée dans « Bornes et QR ».');
    expect(api.requests.filter((request) => request.startsWith('PUT'))).toEqual([]);
  });

  it('lists a gate not yet verified as missing, by its name', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    api.publication.set(parkingDemo.id, readyParkingDemo({ gates: [{ ...sortieDemoGate, verifiedAt: null }] }));
    renderDashboard({ path: publicationPathOf(parkingDemo.id) });

    await screen.findByRole('heading', { level: 1, name: 'Mise en ligne — Parking Démo' });

    expect(checklistLineOf('Sortie vérifiée : Sortie Démo')).toBe('Sortie vérifiée : Sortie Démo Manquant Non vérifiée : lancez un passage de test depuis son contrôleur.');
    expect(plainText(screen.getByText(/^Il manque/))).toBe('Il manque : Borne d’entrée et Sortie vérifiée : Sortie Démo.');
  });

  it('reads the checklist again when the API refuses LOT_NOT_READY, and says why', async () => {
    const api = await openPublicationOf(sophie, parkingDemo);
    api.publication.set(parkingDemo.id, readyParkingDemo({ gates: [entreeUnverified()] }));

    await userEvent.click(screen.getByRole('button', { name: 'Mettre en ligne' }));

    expect(plainText(await screen.findByRole('alert'))).toBe('Il manque encore un prérequis : le stationnement reste hors ligne. La liste a été relue.');
    expect(stateWordOf('Entrée vérifiée : Entrée Démo')).toBe('Manquant');
    expect((screen.getByRole('button', { name: 'Mettre en ligne' }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.requests.filter((request) => request === `GET /lots/${parkingDemo.id}/publication`)).toHaveLength(2);
  });

  it('answers Sophie that Pierre’s lot is not found', async () => {
    installFakeApi({ signedInAs: sophie });
    renderDashboard({ path: publicationPathOf(garageRoy.id) });

    expect(await screen.findByRole('heading', { level: 1, name: 'Introuvable' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mettre en ligne' })).toBeNull();
  });
});

function entreeUnverified() {
  const [entree] = readyParkingDemo().gates;
  return { ...(entree ?? sortieDemoGate), verifiedAt: null };
}
