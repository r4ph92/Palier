# 044 — Temps de présence moyen par voie

**Contexte.** #77 : Sophie Lavoie veut le temps que les véhicules passent à chaque barrière, mesuré, pour démontrer la vitesse des voies Palier (Q42, Q49). Un passage ne portait que l'instant de fermeture de la boucle (`closed_at`) ; l'instant d'armement, promis par `docs/02` et Q49, n'était stocké nulle part.

**Décision.**
- **Colonne** (migration 0044) : `gate_passage.armed_at timestamptz` nulle, `CHECK (armed_at is null or armed_at <= closed_at)`, index partiel `gate_passage_presence_index (gate_id, closed_at) where armed_at is not null`. Les passages existants restent à `null` et sont exclus de la moyenne.
- **Requête** : `POST /v1/gates/:id/passage` accepte `armedAt` (optionnel, `date-time`). Le serveur le garde seulement s'il est représentable et antérieur ou égal à `closedAt` ; sinon il l'enregistre à `null` et le passage compte quand même : une horloge de contrôleur fautive ne doit jamais faire perdre un véhicule. Aucun plafond de durée : il flatterait le chiffre, la carte ne le demande pas.
- **Rejeu hors ligne** : un passage rejoué ne porte pas d'instant d'armement, il est donc exclu de la moyenne. Les passages mis en file par la console hors ligne ne le portent pas non plus.
- **Moyenne** : `avg(closed_at - armed_at)` en secondes par barrière, sur les passages dont `armed_at` n'est pas nul et dont `closed_at` est dans les 7 derniers jours. La fenêtre se compte sur `closed_at` (jamais `recorded_at`, qui date un rejeu de son envoi) et son début vient de l'horloge de l'application, la même que `now` de la page. Pas de borne supérieure. Une barrière sans passage mesuré reste absente de la lecture et la page affiche « aucun passage mesuré ».
- **Lecture** : méthode propre `LotEquipmentReader.readGatePresence`, énoncé propre (`readGatePresenceStatement`, nommé par opérateur et parking) ; `readLotGates` et la page d'occupation sont intacts. La valeur est brute (`averagePresenceSeconds`, `number | null`), arrondie une seule fois, par le tableau de bord, à une décimale (« 9,0 s », "9.0 s").
- **Console de démonstration** : bouton « Véhicule sur la boucle d'armement » pour l'entrée ; « Véhicule à la sortie » arme aussi la sortie. Le prochain appui sur la boucle de cette barrière envoie `armedAt` et l'efface. Le module `presenceArming.js` tient l'instant ; il est effacé à chaque appui sur une boucle (envoyé, mis en file ou refusé), à tout changement de clé et à chaque nouvel armement.

**Hors portée.** Un véhicule refoulé qui recule n'efface pas l'armement : le suivant réarme (console de démo seulement). Aucune médiane ni distribution.

**Preuve SQL.** Énoncé testé sur l'exécuteur scripté (décision 005) et vérifié à la main sur la base de la voie (8, 9 et 10 s à Sortie Démo donnent 9, un passage sans armement est exclu).
