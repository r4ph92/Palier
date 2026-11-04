import type { Vehicle } from '@palier/shared-types';
import { useState } from 'react';
import type { PaymentMethodClient } from '../api/PaymentMethodClient';
import type { VehicleClient } from '../api/VehicleClient';
import { usePaymentCard } from '../payment/usePaymentCard';
import { AccountScreen, type DeveloperLink } from './AccountScreen';
import { AddVehicleScreen } from './AddVehicleScreen';
import type { DeveloperEntry } from './DeveloperEntry';
import { EditVehicleScreen } from './EditVehicleScreen';
import { PaymentMethodScreen } from './PaymentMethodScreen';
import { VehiclesScreen } from './VehiclesScreen';

export type AccountPage = 'account' | 'vehicles' | 'addVehicle' | 'editVehicle' | 'payment' | 'developer';

interface AccountClients {
  readonly payment: PaymentMethodClient;
  readonly vehicles: VehicleClient;
}

interface AccountTabProps {
  readonly firstName: string;
  readonly page: AccountPage;
  readonly clients: AccountClients;
  readonly developerEntry: DeveloperEntry | undefined;
  readonly onPageChange: (page: AccountPage) => void;
  readonly onSignOut: () => void;
}

export function AccountTab({ firstName, page, clients, developerEntry, onPageChange, onSignOut }: AccountTabProps) {
  const { state: cardState, setCard } = usePaymentCard(clients.payment);
  const goTo = (target: AccountPage) => () => onPageChange(target);
  const { editedVehicle, editVehicle } = useEditedVehicle(onPageChange);
  switch (page) {
    case 'account':
      return <AccountScreen cardState={cardState} onOpenVehicles={goTo('vehicles')} onOpenPaymentMethod={goTo('payment')} onSignOut={onSignOut} {...developerLinkFor(developerEntry, goTo('developer'))} />;
    case 'vehicles':
      return <VehiclesScreen firstName={firstName} client={clients.vehicles} onAddVehicle={goTo('addVehicle')} onEditVehicle={editVehicle} />;
    case 'addVehicle':
      return <AddVehicleScreen client={clients.vehicles} onCancel={goTo('vehicles')} onSaved={goTo('vehicles')} />;
    case 'editVehicle':
      return editedVehicle && <EditVehicleScreen client={clients.vehicles} vehicle={editedVehicle} onCancel={goTo('vehicles')} onSaved={goTo('vehicles')} />;
    case 'payment':
      return <PaymentMethodScreen client={clients.payment} onSaved={setCard} onBack={goTo('account')} />;
    case 'developer':
      return developerEntry === undefined ? null : <developerEntry.Panel onBack={goTo('account')} />;
  }
}

// The vehicle the edit page shows, kept here because the page itself is only a name.
function useEditedVehicle(onPageChange: (page: AccountPage) => void) {
  const [editedVehicle, setEditedVehicle] = useState<Vehicle | null>(null);
  const editVehicle = (vehicle: Vehicle) => {
    setEditedVehicle(vehicle);
    onPageChange('editVehicle');
  };
  return { editedVehicle, editVehicle };
}

function developerLinkFor(entry: DeveloperEntry | undefined, onOpen: () => void): { readonly developerLink: DeveloperLink } | Record<never, never> {
  return entry === undefined ? {} : { developerLink: { label: entry.label, onOpen } };
}
