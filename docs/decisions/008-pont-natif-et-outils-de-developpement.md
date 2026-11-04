# 008 — Pont natif typé et outils de développement hors du bundle de production

## Contexte
Le positionnement (balises, détection du stationnement) passera par des modules natifs (#19, #20). Les stories de positionnement doivent se tester dans le Simulateur iOS, sans balise ni module natif, et l'app tourne dans Expo Go (décision 001).

## Décision
- Le contrat du pont (4 commandes, 4 événements de `docs/04`) est un port TypeScript dans `apps/mobile/src/positioning/` : `PositioningModule`, `PositioningListener`, et `PositioningCore` qui relaie les commandes et diffuse les événements aux abonnés, chacun isolé par un try/catch. Horodatages en millisecondes epoch ; confiance `low | medium | high`. Détail : `docs/pont-natif.md`.
- En production, `NullPositioningModule` tient la place du module natif.
- Le module simulé et le panneau « Signaux simulés » vivent dans `apps/mobile/src/dev/`, chargés par un seul ternaire `__DEV__ ? require(...) : null` : Metro replie la constante et retire le `require` du bundle de production. Aucun libellé ni identifiant du panneau n'est dans `fr.ts`/`en.ts`.

## Conséquences
- Le panneau n'existe que dans un bundle de développement ; la preuve est un `expo export` sans aucune occurrence des identifiants du panneau (vérifié en QA et par le pentest).
- Les stories #19/#20 implémentent `PositioningModule` sans toucher au cœur ni au panneau.
- Un abonné défaillant ne bloque ni les autres ni le rappel natif.
