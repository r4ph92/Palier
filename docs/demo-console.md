# Console de démonstration

La console joue le contrôleur d'une barrière et ses boucles (D13). Chaque
bouton envoie un vrai passage à l'API, qui met à jour le compteur de véhicules
du parking ; l'app affiche ensuite les places libres recalculées.

## Activer le mode démo

La console n'existe que si `DEMO_MODE=true` dans la configuration de l'API
(`apps/api/.env`, déjà présent dans `.env.example`). Toute autre valeur que
`true` ou `false` empêche le serveur de démarrer. Au démarrage en mode démo,
l'API journalise un avertissement. Sans mode démo, `/demo/console` répond 404.

```
npm run start --workspace @palier/api       # avec DEMO_MODE=true dans apps/api/.env
open http://localhost:3000/demo/console
```

## Clés d'appareil semées

Clés de développement seulement (`apps/api/src/seed/fixtures/gates.ts`) ; la
base n'en garde que l'empreinte SHA-256. `npm run seed --workspace @palier/api`
les recrée et remet le compteur à 0.

| Barrière | Parking | Sens | Clé |
|---|---|---|---|
| Entrée Démo | Parking Démo | entrée | `gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as` |
| Sortie Démo | Parking Démo | sortie | `Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw` |
| Entrée Roy | Garage Roy (hors ligne) | entrée | `qwWc90SgLYX15MzN2UBX8lSQA-hKBlaqbIG9v--98tM` |
| Entrée Démo, clé **révoquée** | Parking Démo | entrée | `L-xYpKfzUH4NHKxi_r6EKJbBXOIiYvhbawTSt34sgRs` |

## QR des bornes semées

Le contenu de chaque QR imprimé, à coller dans l'onglet « Scanner » de l'app
(champ « Contenu du QR ») tant que la caméra n'existe pas (#45). Les secrets sont
fixes dans `apps/api/src/seed/fixtures/gates.ts`, donc ces liens ne changent pas
d'un seed à l'autre ; `npm run seed --workspace @palier/api` les affiche aussi.

| Borne | Contenu du QR | Réponse attendue |
|---|---|---|
| Entrée Démo | `https://palier.app/q/palier1.00000000-0000-4000-8000-000000000701.-Un39K4J0Of87m3s0GAvLuA4iU_WHFQcti4imXHXk6s` | place attribuée, « Barrière ouverte » |
| Sortie Démo | `https://palier.app/q/palier1.00000000-0000-4000-8000-000000000702.5zM0Mh2G5z5103ZlWxTZQpV74SzJzqo4FatczcMHJQ0` | « Ce QR n’est pas une borne d’entrée » |
| Entrée Roy | `https://palier.app/q/palier1.00000000-0000-4000-8000-000000000703.58pH8pV4hMitS9Lj679T9Tw5EDVtxcUQ2aQDqVATUXY` | « Ce parking n’est pas en service » |

L'entrée exige `STRIPE_SECRET_KEY` (clé `sk_test_`) dans `apps/api/.env`, puis
un seed, pour que les conducteurs aient une carte ; sans clé, l'entrée répond
503 et l'app affiche « Palier ne répond pas, réessayez dans un instant » à
l'étape du paiement. `DEMO_OPERATOR_STRIPE_ACCOUNT_ID` (`acct_…`, facultatif) dirige l'autorisation vers le compte connecté de test de
Stationnements Lavoie ; sans lui, elle reste sur la plateforme (mode démo
seulement). Une entrée par conducteur et par seed : la deuxième répond « Vous
avez déjà une entrée en cours ».

## Sortie par lecteur de plaque ou de transpondeur (#52)

Sortie Démo est semée avec un lecteur de plaque (`exit_id_kind = 'ANPR'`). Pour
essayer le transpondeur, ajouter un transpondeur au véhicule (Compte >
Véhicules > Modifier > « Transpondeur (facultatif) »), puis changer le lecteur :

```
update gate set exit_id_kind = 'RFID' where name = 'Sortie Démo';
```

Coller la clé de Sortie Démo, écrire la plaque (« abc123 », casse et espaces
sans importance) ou le transpondeur (« T-0042 ») dans « Plaque lue » et appuyer
sur « Envoyer la lecture ». Pour un conducteur dans le parking, la capture se
fait, la barrière s'ouvre (« Ouverture commandée ») et le reçu apparaît dans
Compte > Reçus. Sans session ouverte pour cette plaque, ou avec deux, la console
affiche « Aucune session — repli sur l'app » et rien n'est capturé.

## Utiliser la console

1. Coller une clé dans « Clé d'appareil ». La clé ne quitte jamais la page :
   ni URL, ni stockage du navigateur.
2. Appuyer sur « Boucle d'entrée fermée » ou « Boucle de sortie fermée ». Au
   premier appui, la console identifie la barrière (`GET /v1/gates/me`), affiche
   son nom, son sens et son parking, puis désactive le bouton de l'autre sens.
3. Chaque passage enregistré s'ajoute à la liste avec son heure et le nombre de
   véhicules dans le parking. Tirer la liste de l'app vers le bas pour voir les
   places libres.
4. Dès qu'une clé bien formée est saisie, la console demande chaque seconde les
   commandes de sa barrière : chaque entrée admise par l'app s'affiche sous
   « Commandes » (« Ouverture commandée · 18 h 02 »), la plus récente en haut.

Messages : « Clé d'appareil refusée » (clé inconnue, mal formée ou révoquée),
« Accès refusé pour cette barrière » (403), « Cette barrière n'a pas de
boucles. » (409), « Impossible de joindre Palier. » (API arrêtée). Le bouton
« English » passe toute la page en anglais.

## Scénarios

- **Entrée par QR** : clé d'Entrée Démo dans la console ; Julie colle le QR
  d'Entrée Démo dans « Scanner » : l'app affiche « Votre place : A-1 · Palier P1
  · Allée A » et « Barrière ouverte », la console « Ouverture commandée », et
  Parking Démo passe à 9 places libres (place attribuée).
- **Entrée** : clé d'Entrée Démo, une entrée : l'app passe de 10 à 9 places libres.
- **Sortie** : clé de Sortie Démo, une sortie : retour à 10.
- **Complet** : 10 entrées : l'app affiche « Complet ». 12 entrées : toujours
  « Complet », jamais de nombre négatif (places affichées =
  `min(capacité − véhicules, places libres)`, plancher 0).
- **Clé refusée** : une clé quelconque ou la clé révoquée : « Clé d'appareil
  refusée », le compteur ne bouge pas.
- **Entrée annulée sans passage** (#39) : sans clé Stripe, l'entrée par l'app
  répond 503 ; on crée donc la session de Julie et sa commande d'ouverture en SQL,
  avec une `issued_at` reculée de `ago` secondes (base de la voie à adapter) :

  ```
  docker exec -i palier-postgres-1 psql -U palier -d palier -v ago=61 <<'SQL'
  with chosen_spot as (
    update spot set state = 'ASSIGNED', state_changed_at = now()
    where id = (select id from spot where lot_id = '00000000-0000-4000-8000-000000000201'
                and state = 'AVAILABLE' order by number limit 1)
    returning id
  ), session as (
    insert into parking_session (user_id, vehicle_id, plate, lot_id, assigned_spot_id, entry_gate_id,
      authorized_cents, pricing_increment_cents, pricing_increment_minutes, pricing_daily_cap_cents,
      payment_intent_id, entry_scan_at)
    select u.id, v.id, v.plate, '00000000-0000-4000-8000-000000000201', chosen_spot.id,
      '00000000-0000-4000-8000-000000000701', 2500, 75, 15, 2500, 'pi_demo_julie', now() - make_interval(secs => :ago)
    from app_user u join vehicle v on v.user_id = u.id, chosen_spot
    where u.email = 'julie.tremblay@palier.test'
    returning id
  )
  insert into gate_command (gate_id, lot_id, kind, session_id, issued_at)
  select '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000201', 'OPEN', id,
    now() - make_interval(secs => :ago)
  from session returning session_id;
  SQL
  ```

  Ouverture reculée de 61 s : au passage suivant de la tâche (30 s
  au plus), la session passe à `CANCELLED`, la place revient à `AVAILABLE` et
  Parking Démo retrouve ses places libres ; l'API journalise
  `cancelled an entry nobody drove through`. Ouverture reculée de 59 s puis
  « Boucle d'entrée fermée » aussitôt : la session est confirmée et le reste. Un appui
  sur « Boucle d'entrée fermée » après l'annulation ajoute 1 au compteur
  et la session reste annulée.
- **Mauvaise barrière** (la console poste toujours vers sa propre barrière, donc
  par curl) :

  ```
  curl -i -X POST http://localhost:3000/v1/gates/00000000-0000-4000-8000-000000000702/passage \
    -H 'authorization: Bearer gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as' \
    -H 'content-type: application/json' -d '{"closedAt":"2026-10-27T22:02:00Z"}'
  ```

  Réponse 403 `GATE_FORBIDDEN`, compteur inchangé.

## API utilisée

- `GET /v1/gates/me` : `{ id, name, kind, lotName }` de la barrière de la clé.
- `POST /v1/gates/:id/passage`, corps `{ "closedAt": "<ISO 8601>" }` :
  `{ gateId, lotId, kind, closedAt, vehicleCount, confirmedSessionId, exitedSessionId }`.
  `confirmedSessionId` est la session d'entrée que ce passage a confirmée (la plus
  ancienne ouverture de cette barrière émise dans les 60 secondes (`ENTRY_CONFIRMATION_WINDOW_SECONDS`) avant la réception du passage, mesurées
  sur l'horloge de Postgres seule : la dérive de la console n'y change rien), ou
  `null` s'il n'y en avait aucune ou à une sortie. `exitedSessionId` est, à la
  sortie, la session payée dont l'ouverture de sortie date de moins de 60 secondes
  (même fenêtre) et qui reçoit `exit_passage_at` ; `null` sinon, et toujours à une entrée.
  Le compteur baisse dans les deux cas (jamais sous 0). Le sens et le parking
  viennent de la barrière, jamais du corps. `closedAt` à plus de 5 minutes dans
  le futur : 400.
- `GET /v1/gates/me/commands?after=<ISO 8601>&afterId=<uuid>` : `[{ id, kind: "OPEN", issuedAt }]`
  de la barrière de la clé, triées par `issuedAt` puis `id`, 50 au plus ;
  strictement après le curseur `(after, afterId)` (la dernière commande lue), ou
  les 50 dernières sans curseur. Curseur incomplet ou illisible : 400.
- Authentification : `Authorization: Bearer <clé>` (32 octets en base64url,
  43 caractères). Toute clé absente, mal formée, inconnue ou révoquée reçoit le
  même 401 avec `WWW-Authenticate: Bearer`, avant toute lecture du corps.
