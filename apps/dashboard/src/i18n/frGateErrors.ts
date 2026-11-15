// The gates' refusals, kept apart so the main dictionary stays short.
export const frGateErrors = {
  GATE_NOT_FOUND: 'Cette borne est introuvable. La liste des bornes a été rechargée.',
  GATE_NAME_REQUIRED: 'Entrez le nom de la borne.',
  GATE_NAME_INVALID: 'Le nom doit compter de 1 à %{gateNameMaximum} caractères, sans caractère invisible.',
  GATE_NAME_TAKEN: 'Ce stationnement a déjà une borne avec ce nom.',
  GATE_ENDPOINT_NOT_HTTPS: 'Entrez une adresse https, comme https://controle.exemple.ca, sans nom d’utilisateur ni mot de passe.',
  GATE_ENDPOINT_REQUIRED: 'L’API de contrôle d’accès demande l’adresse https de son contrôleur.',
  GATE_EXIT_ID_ON_ENTRY: 'Seule une borne de sortie identifie les véhicules.',
  GATE_EXIT_LIMIT: 'Ce stationnement a déjà sa borne de sortie. Choisissez Entrée.',
  GATE_LIMIT_REACHED: 'Un stationnement compte au plus %{gatesPerLotMaximum} bornes.',
  GATE_RELOAD_FAILED: 'La liste des bornes n’a pas pu être rechargée après ce refus. Rechargez la page avant de recommencer.',
};
