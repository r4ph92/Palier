# 017 — Demande de localisation « Toujours » et indicateur par appareil

**Contexte.** Q41 : la demande « Toujours » se fait avant le premier scan, avec une explication. iOS ne la montre qu'une fois, et l'accueil (#5) demande déjà « pendant l'utilisation » : le statut « non déterminé » d'iOS ne dit donc pas « jamais expliqué ».

**Décision.**
- **Indicateur propre à l'appareil** : `palier.locationExplanationAnswered` dans `expo-secure-store` (`LocationExplanationStore`). Il n'est pas effacé à la déconnexion : la permission iOS appartient à l'appareil, pas au conducteur.
- **Écran avant le scanner** : « Scanner » affiche `LocationExplanationScreen` tant que l'indicateur est absent et qu'aucune session n'est en cours. « Continuer » appelle `requestAlways()` (`requestBackgroundPermissionsAsync`), puis pose l'indicateur quelle que soit la réponse, échec compris. « Continuer sans » le pose sans demande.
- **Refus sans conséquence pour l'entrée** : le scanner s'ouvre dans tous les cas. Sans « Toujours », la session affiche « Détection automatique désactivée » et un lien vers les réglages iOS (`Linking.openSettings`) ; le statut est relu au retour de l'app au premier plan.
- **Deux ports** : `BackgroundLocationClient` à côté de `DeviceLocationClient`, pour que le tri par distance (#5) ne dépende pas de la permission « Toujours ».

**Conséquences.** Expo Go ne montre ni la raison « Toujours », ni l'indicateur bleu, ni le vrai état de la permission : seul un build de développement les prouve (les chaînes iOS viennent de `app.config.ts`).
