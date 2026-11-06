# 017 — Demande de localisation « Toujours » et indicateur par appareil

**Contexte.** Q41 : la demande « Toujours » se fait avant le premier scan, avec une explication. iOS ne la montre qu'une fois, et l'accueil (#5) demande déjà « pendant l'utilisation » : le statut « non déterminé » d'iOS ne dit donc pas « jamais expliqué ».

**Décision.**
- **Indicateur propre à l'appareil** : un fichier `location-explanation-answered` dans le dossier de documents de l'app (`expo-file-system`, `LocationExplanationStore`). Il disparaît avec l'app, comme iOS réinitialise alors ses invites ; un élément du trousseau survivrait à la désinstallation et l'invite ne reviendrait plus. Il n'est pas effacé à la déconnexion : la permission iOS appartient à l'appareil, pas au conducteur. « Réinitialiser la localisation et la confidentialité » (Réglages iOS) réinitialise les invites sans toucher au fichier : l'explication ne revient pas dans ce cas, seul l'écran de réglages reste possible. Une écriture qui échoue compte quand même comme répondu jusqu'à la fermeture de l'app (`rememberingAnswer`, au-dessus des onglets).
- **Écran avant le scanner** : « Scanner » affiche `LocationExplanationScreen` tant que l'indicateur est absent et qu'aucune session n'est en cours. « Continuer » appelle `requestAlways()` (`requestBackgroundPermissionsAsync`), puis pose l'indicateur quelle que soit la réponse, échec compris. « Continuer sans » le pose sans demande.
- **Refus sans conséquence pour l'entrée** : le scanner s'ouvre dans tous les cas. Sans « Toujours » (`hasAlways` faux), la session affiche « Détection automatique désactivée » et un lien vers les réglages iOS (`Linking.openSettings`) ; le statut est relu au retour de l'app au premier plan.
- **Deux ports** par ségrégation d'interfaces : `BackgroundLocationClient` (`requestAlways`, `hasAlways`) à côté de `DeviceLocationClient`, pour que `locateDriver` et le tri par distance (#5) n'aient aucun moyen de demander « Toujours ».

**Conséquences.** Expo Go ne montre ni la raison « Toujours », ni l'indicateur bleu, ni le vrai état de la permission : seul un build de développement les prouve (les chaînes iOS viennent de `app.config.ts`).
