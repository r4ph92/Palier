import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DashboardUser } from '@palier/shared-types';
import { installFakeApi } from './fakeDashboardApi.ts';
import { renderDashboard } from './renderDashboard.tsx';

const WHITESPACE = /\s+/g;

export function publicationPathOf(lotId: string): string {
  return `/lots/${lotId}/publication`;
}

export async function openPublicationOf(user: DashboardUser, lot: { readonly id: string; readonly name: string }) {
  const api = installFakeApi({ signedInAs: user });
  renderDashboard({ path: publicationPathOf(lot.id) });
  await screen.findByRole('heading', { level: 1, name: `Mise en ligne — ${lot.name}` });
  return api;
}

// The line's name, state word and detail, with every kind of space read as one plain space.
export function checklistLineOf(name: string): string {
  const line = screen.getByText(name, { selector: '.checklist-name' }).closest('li') as HTMLElement;
  return [...line.children].map((part) => plainText(part as HTMLElement)).join(' ');
}

export function stateWordOf(name: string): string {
  const line = screen.getByText(name, { selector: '.checklist-name' }).closest('li') as HTMLElement;
  return line.querySelector('.state-mark')?.textContent ?? '';
}

export function attestationForm(title: string): HTMLElement {
  return screen.getByRole('form', { name: title });
}

export async function attest(title: string, { measuredOn, note }: { readonly measuredOn: string; readonly note: string }): Promise<void> {
  const form = attestationForm(title);
  const day = within(form).getByLabelText('Jour de la mesure');
  const noteBox = within(form).getByRole('textbox', { name: 'Constat' });
  await userEvent.clear(day);
  await userEvent.type(day, measuredOn);
  await userEvent.clear(noteBox);
  await userEvent.type(noteBox, note);
  await userEvent.click(within(form).getByRole('button', { name: 'Enregistrer la mesure' }));
}

export function plainText(element: HTMLElement | null): string {
  return (element?.textContent ?? '').replace(WHITESPACE, ' ').trim();
}
