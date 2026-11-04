import type { PaymentMethodClient } from '../api/PaymentMethodClient';
import type { VehicleClient } from '../api/VehicleClient';
import { usePaymentCard } from '../payment/usePaymentCard';
import { AccountScreen, type DeveloperLink } from './AccountScreen';
import { AddVehicleScreen } from './AddVehicleScreen';
import type { DeveloperEntry } from './DeveloperEntry';
import { PaymentMethodScreen } from './PaymentMethodScreen';
import { VehiclesScreen } from './VehiclesScreen';

export type AccountPage = 'account' | 'vehicles' | 'addVehicle' | 'payment' | 'developer';

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
  switch (page) {
    case 'account':
      return <AccountScreen cardState={cardState} onOpenVehicles={goTo('vehicles')} onOpenPaymentMethod={goTo('payment')} onSignOut={onSignOut} {...developerLinkFor(developerEntry, goTo('developer'))} />;
    case 'vehicles':
      return <VehiclesScreen firstName={firstName} client={clients.vehicles} onAddVehicle={goTo('addVehicle')} />;
    case 'addVehicle':
      return <AddVehicleScreen client={clients.vehicles} onCancel={goTo('vehicles')} onSaved={goTo('vehicles')} />;
    case 'payment':
      return <PaymentMethodScreen client={clients.payment} onSaved={setCard} onBack={goTo('account')} />;
    case 'developer':
      return developerEntry === undefined ? null : <developerEntry.Panel onBack={goTo('account')} />;
  }
}

function developerLinkFor(entry: DeveloperEntry | undefined, onOpen: () => void): { readonly developerLink: DeveloperLink } | Record<never, never> {
  return entry === undefined ? {} : { developerLink: { label: entry.label, onOpen } };
}
