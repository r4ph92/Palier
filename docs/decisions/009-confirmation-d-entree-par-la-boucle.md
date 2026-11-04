# 009 — Confirmation d'entrée par la boucle d'entrée

**Contexte.** L'ouverture de la barrière ne prouve pas que la voiture est entrée
(Q33 : la boucle est la seule preuve de passage, sans caméra). Le passage de
boucle ne connaissait que le compteur de véhicules du parking.

**Décision.**
- Une fermeture de boucle à une barrière d'entrée confirme, dans la même transaction
  que le compteur, l'ouverture en attente la plus ancienne de cette barrière : la
  commande `OPEN` dont la session est encore `CREATED` et émise au plus 60 s avant
  l'horloge de Postgres (`issued_at >= now() − 60 s`, sans borne supérieure). Le domaine
  ne transmet que la durée ; Postgres, qui a aussi horodaté la commande, est la seule
  horloge qui décide : la dérive de la console ne joue pas. `closedAt` reste l'heure de passage enregistrée et vaut `entry_confirmed_at`. La session passe à `ENTRY_CONFIRMED` avec `entry_confirmed_at`,
  et sa place de `ASSIGNED` à `OCCUPIED`. Le `UPDATE … FOR UPDATE OF s`
  attend le verrou de ligne `parking_lot` pris par le compteur (`countVehicle`, qui doit
  s'exécuter en premier) : il sérialise les fermetures d'un même parking, donc deux
  fermetures ne confirment pas la même session. Lacune : l'ordre FIFO n'est vérifié que
  par la base, la doublure de test du registre ne le prouve pas.
- Le compteur monte de 1 dans tous les cas ; sans ouverture en attente, aucune
  session ne change (`confirmedSessionId: null`).
- La migration 0009 recrée le type d'état (une nouvelle valeur d'énumération ne peut pas
  servir dans la transaction qui l'ajoute) et les deux index uniques partiels (décision 007).
- L'app lit `GET /v1/entries/:sessionId` toutes les 2 s, jusqu'à 2 min, tant que
  l'entrée n'est pas confirmée.

**Conséquences.** Une ouverture de plus de 60 s avant la boucle reste `CREATED` jusqu'à #39.
Une horloge de console en avance de plus de 5 min est refusée comme avant, sans effet sur la fenêtre.
