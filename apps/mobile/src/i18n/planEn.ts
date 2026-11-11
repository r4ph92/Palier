import type { Translations } from './fr';

export const planEn: Translations['session']['plan'] = {
  goToLead: 'Go to aisle %{aisle}, spot ',
  wrongAisle: 'You are in aisle %{current}\u00A0— your spot is in aisle %{assigned}',
  rightAisle: 'You are in the right aisle',
  aisle: 'Aisle %{aisle}',
  spotLead: 'Spot ',
  youAreHere: 'You are here',
  imageLabel: 'Plan of level %{level}',
  imageAssigned: ': aisle %{aisle} highlighted, spot %{spot}',
  imageHere: ', you are here: aisle %{aisle}',
};
