# 021 — Correction de la place présumée

**Contexte.** #22 : la réponse tardive de docs/02 (`PARKED_PRESUMED` → `PARKED_CONFIRMED`). Palier a présumé A-1 au passage à pied (019) et le conducteur dit que la voiture est ailleurs.

**Décision.**
- **Même route, même transaction** : `POST /v1/entries/:sessionId/spot` accepte aussi une session `PARKED_PRESUMED`, avec la validation, les verrous parking → session → place et les refus de 020 (`UNKNOWN_SPOT`, `SPOT_TAKEN`, `SPOT_OUT_OF_SERVICE`, `SESSION_CLOSED`). Pas de nouvelle route ni de migration.
- **Déplacement** : la place nommée passe `OCCUPIED`, puis la place présumée passe `OCCUPIED_UNKNOWN` avec `needs_check`, puis la session `PARKED_CONFIRMED` sur la place nommée, dans la même transaction ; une place présumée qui n'est plus `OCCUPIED` annule tout. 
- **Sa propre place** : nommer la place présumée encore `OCCUPIED` confirme la présomption : aucune écriture sur la place, session `PARKED_CONFIRMED` sur A-1. Sortie de `OCCUPIED` entre-temps, elle est traitée comme toute autre place (occupée de nouveau, ou refusée hors service). La règle rend un plan (`placementOf`) que le dépôt exécute.
- **Une seule correction** : une session déjà `PARKED_CONFIRMED` garde sa place (200 avec la première, comme 020) et l'app n'offre plus l'action.
- **App** : « Ce n’est pas ma place » (EN « This is not my spot ») sous « Garé en A-1 », en `PARKED_PRESUMED` seulement ; le formulaire de 020 sans liste, titré par l'action, champ « Numéro de la place où vous êtes garé », avec « Annuler » (et le geste d'échappement VoiceOver) qui rend le focus à l'action, absent pendant l'envoi ; après la correction, le focus VoiceOver passe à « Garé en A-3 ». Pas d'avis hors ligne dans ce formulaire : il ne montre ni montant ni places libres, et un envoi sans réseau affiche déjà « Impossible de joindre Palier ».

**Conséquences.** Le risque accepté de 020 s'élargit : toute session présumée, et plus seulement celle qui a menti sur l'allée, peut prendre n'importe quelle place libre et laisser la sienne à vérifier.
