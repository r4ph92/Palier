# 016 — Place garantie 15 minutes

**Contexte.** Q22 promet une garantie de trajet : le conducteur qui part vers un parking doit y trouver une place. Rien ne réservait de place avant #6 ; libération (#7), expiration (#8) et usage à l'entrée (#9) viennent après.

**Décision.**
- **Une garantie par conducteur, tous parkings confondus** : index unique partiel sur `spot_hold.user_id` des garanties `ACTIVE`. Un double tap ou deux demandes simultanées donnent une garantie et `HOLD_ALREADY_EXISTS`.
- **Quota de 3 garanties par parking** (`SPOT_HOLD_QUOTA_PER_LOT`) et durée de 15 minutes, constantes du domaine : une colonne viendra quand un opérateur pourra les régler.
- **Place `HELD`** : la place est choisie par les règles d'attribution pour le véhicule par défaut (#43, #44), sous le verrou du parking de la décision 014, puis passe `HELD`. Elle sort du compte affiché à tous et de la place restante (`capacité − véhicules − places HELD`), par une seule règle, `hasRoomForAnotherVehicle`.
- **Une seule horloge** : l'API lit l'heure une fois par demande et la passe à chaque instruction (`created_at`, `expires_at`, `state_changed_at` de la place) ; aucun `now()` de Postgres pour les garanties. L'horloge de test les pilote donc aussi (décision 011).
- **Avant #8** : rien n'expire. La garantie reste `ACTIVE` et sa place `HELD` après 15 minutes ; l'app affiche `0:00`. La fuite est bornée à 3 places par parking et une par conducteur.
- **Avant #9** : à l'entrée, un conducteur dont la garantie a pris la dernière place reçoit `LOT_FULL` ; s'il reste de la place, il reçoit une autre place `AVAILABLE` et la place `HELD` attend #8. #8 puis #9 doivent suivre #6.
- **Données (Q23)** : `spot_hold.user_id` est une donnée identifiante, conservée 90 jours comme les autres. L'avis de confidentialité couvre déjà « trouver votre place » : version inchangée.

**Conséquences.** Le SQL et la concurrence ne sont prouvés que sur la base de la voie (décisions 002 et 005) ; l'ordre des instructions sous le verrou a des tests unitaires sur un exécuteur scripté.
