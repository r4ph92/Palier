# 045 — Sorties par mode d'identification

**Contexte.** #78 : Sophie veut la part des sorties selon la façon dont le véhicule a été identifié, pour savoir si la sortie sans geste fonctionne dans son parking (docs/02). Lecture seule : aucune migration.

**Décision.**
- **Route** : `GET /v1/dashboard/lots/:id/exits` (cookie du tableau de bord, `GATED` dans `routeClassification.ts`). Un parking étranger, inconnu ou mal formé répond le même 404 `LOT_NOT_FOUND`. La réponse ne porte que des comptes : le nom du parking, le total et un compte par mode, jamais de plaque, d'utilisateur ni de paiement.
- **Fenêtre** : `exit_at >= maintenant - 30 jours` et `exit_identification` non nul, sans borne haute. L'instant limite est calculé dans le domaine avec l'horloge injectée (l'horloge de test quand elle est active) et passé en paramètre à l'instruction. Pas de nouvel index : l'échelle de la démo suffit, à reprendre si un parking dépasse quelques centaines de milliers de sorties.
- **Une seule instruction** : `parking_lot` en jointure gauche avec `parking_session`, groupée par mode. Un parking sans sortie donne une ligne au compte nul (page vide, pas un 404) ; le parking d'un autre opérateur ne donne aucune ligne.
- **« Personnel »** : aucune sortie par le personnel n'existe encore (l'énumération `exit_identification` n'a pas cette valeur). La liste affichée a quand même les cinq modes, dans l'ordre de la story (balise, app, plaque, transpondeur, personnel) ; `STAFF` est un mode d'affichage seulement, toujours à 0 %, sans changement d'énumération. Quand une sortie par le personnel sera construite, il suffira de la compter.
- **Libellés** : FR Balise, App, Plaque, Transpondeur, Personnel ; EN Beacon, App, Plate, Transponder, Staff. Les deux langues listent les cinq modes.
- **Arrondi** : chaque part est arrondie seule (`Math.round(compte × 100 / total)`). Le total affiché peut donc valoir 99 % ou 101 % (par exemple 3 sorties : 33 % + 33 % + 33 %). C'est assumé : répartir l'écart cacherait un compte.
- **Page** : `/lots/:id/exits`, « Sorties » / "Exits", lien dans la page du parking, lue une fois à l'ouverture (pas d'interrogation périodique : une part sur 30 jours ne bouge pas pendant la lecture). Le total, puis une liste `<ul>` de parts « Balise 50 % » ; les points médians sont masqués aux lecteurs d'écran (`aria-hidden`) et la liste passe à la ligne à 375 px. Vide : « Aucune sortie sur 30 jours » / "No exits in 30 days".

**Hors portée.** Une sortie par le personnel. Une fenêtre au choix. Une courbe dans le temps.

**Preuve.** Décision 002 : tests unitaires seulement. L'instruction est testée sur l'exécuteur scripté (paramètres, filtre d'opérateur, groupement, aucune colonne d'identité) ; la lecture sur 10 sorties insérées se vérifie sur la base du couloir.
