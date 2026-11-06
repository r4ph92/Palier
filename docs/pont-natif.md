# Pont natif

Contrat entre le code TypeScript de l'app et les modules natifs de positionnement. Source : `docs/04-architecture.html` (bande « Pont natif — le contrat »). Ces huit signatures sont fixes : le module Android pourra s'écrire plus tard sans toucher au TypeScript.

Le port TypeScript est `apps/mobile/src/positioning/PositioningModule.ts`. `PositioningCore` en est l'unique point d'entrée côté app : il transmet les commandes au module et diffuse les événements à ses abonnés (`subscribe`).

## Types sur le pont

- `ts` et `until` sont des instants en millisecondes depuis l'epoch (`number`). Le port TypeScript les expose tels quels, sans conversion en `Date`.
- `confidence` vaut `'low'`, `'medium'` ou `'high'`. iOS : les trois niveaux de confiance de CoreMotion. Android : score de 0 à 100 regroupé en `low` sous 34, `medium` sous 67, `high` au-delà.
- `setListener(listener)` est le mécanisme d'abonnement du module, pas une neuvième signature : le cœur l'appelle une fois au démarrage.

## Commandes (JS vers natif)

| Signature | Paramètres | Rôle |
|---|---|---|
| `startMonitoring(uuid, major)` | `uuid` : UUID iBeacon du parking ; `major` : identifiant du parking dans cet UUID | Arme la région du parking |
| `stopMonitoring()` | aucun | Désarme la région à la fermeture de session |
| `keepAlive(until)` | `until` : instant (ms) jusqu'auquel l'app doit rester vivante en arrière-plan | Maintient la localisation en arrière-plan |
| `flushOfflineQueue()` | aucun | Vidange la file hors ligne à la reconnexion |

### `keepAlive` selon la plateforme

Le contrat nomme la commande sans dire comment la plateforme l'honore.

- **iOS** : mises à jour de localisation en arrière-plan, qui exigent la permission « Toujours » ; elles s'arrêtent à `until`.
- **Android** : service de premier plan avec notification persistante, arrêté à `until`.

Le contrat n'a pas de commande d'arrêt : `keepAlive(until)` avec un instant déjà atteint arrête le maintien. L'app l'envoie avec l'instant du passage à pied, une fois la place présumée occupée (#18, `docs/decisions/019`) ; le journal du panneau marque cette ligne « (arrêt) ».

## Événements (natif vers JS)

| Signature | Paramètres | Déclencheur |
|---|---|---|
| `onAisleChanged(minor, ts)` | `minor` : allée la plus proche (0 pour la voie de sortie) ; `ts` : instant de la mesure | Ranging des balises |
| `onLotExit(ts)` | `ts` : instant de la sortie | Sortie de la région du parking |
| `onParkedDetected(confidence, ts)` | `confidence` : fiabilité de la détection ; `ts` : instant du passage à pied | Transition automotive vers walking |
| `onQueueFlushed(count)` | `count` : nombre d'éléments envoyés | Fin de `flushOfflineQueue()` |

## Simuler les signaux en développement

En build de développement (`__DEV__`, Expo Go), **Compte > Développeur > Signaux simulés** remplace le module natif par `SimulatedPositioningModule` (`apps/mobile/src/dev/`). Chaque bouton émet l'événement correspondant par la même interface que le module natif ; les commandes envoyées par le cœur apparaissent dans le journal (100 entrées, la plus récente en haut).

« Réseau coupé » et « Réseau rétabli » sont hors contrat natif : ils écrivent une ligne dans le journal (`setConnectivity`) et changent l'état de connectivité du cœur (`PositioningCore.connectivity`).

## File hors ligne (#26)

Quand le conducteur s'éloigne de sa voiture réseau coupé, ou que l'API est injoignable, l'application garde le signal « Stationné » avec l'instant réel de la marche (`ParkedSignalQueue`, une entrée par session, conservée dans le trousseau d'iOS). Elle l'envoie avec cet instant, et non celui de l'envoi, au retour du réseau, au `flushOfflineQueue()` ou au prochain lancement ; la route `POST /v1/entries/:sessionId/parked` répond 200 à une répétition sans rien changer. L'écran de session affiche « Hors ligne — 1 signal en attente » puis, 5 secondes, « 1 signal envoyé ».

Les builds de production exécutent `NullPositioningModule` tant que les modules natifs iOS et Android (#19, #20) n'existent pas.

Le module simulé n'est chargé que par `loadDeveloperTools.ts`, derrière un ternaire `__DEV__` que Metro évalue à la compilation : le build de production ne contient ni le panneau ni le module. Vérification : `npx expo export --platform ios` puis chercher `SimulatedSignalsPanel` dans la sortie (0 occurrence).
