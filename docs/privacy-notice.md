# Avis de confidentialité (brouillon)

**Statut : à valider.** Le texte ci-dessous est un brouillon pour l'équipe ; la version finale doit être approuvée par le responsable de l'organisation avant la mise en production.

Version en vigueur : la version courante, celle de `PRIVACY_NOTICE_VERSION` dans `packages/shared-types/src/privacy.ts`. Changer la version oblige chaque conducteur à accepter à nouveau avant d'utiliser Palier.

## Texte affiché (FR)

**Vos renseignements**

Pour stationner avec Palier, nous recueillons :

- votre plaque d’immatriculation
- les heures d’entrée et de sortie
- l’allée et la place détectées
- la référence de paiement

Ces renseignements servent à trouver votre place, à facturer le stationnement et à assurer la sécurité des lieux.

Les renseignements identifiants sont conservés 90 jours après votre visite, puis anonymisés.

Boutons : « J'accepte » et « Refuser ». Refuser affiche : « Palier ne peut pas être utilisée sans votre consentement. » avec « Se déconnecter ».

## Texte affiché (EN)

**Your information**

To park with Palier, we collect:

- your licence plate number
- your entry and exit times
- the aisle and spot detected
- a payment reference

We use this to find your spot, bill your parking and keep the lot secure.

Identifying information is kept 90 days after your visit, then anonymized.

Buttons: "I accept" and "Decline". Declining shows: "Palier cannot be used without your consent." with "Sign out".

## Hors du texte affiché

- **Position de l'appareil (#5).** Avec la permission « pendant l'utilisation », l'app lit la position du téléphone pour trier les stationnements par distance. Le calcul se fait sur l'appareil ; la position n'est jamais envoyée à Palier ni conservée (`docs/decisions/015`). Le texte affiché et `PRIVACY_NOTICE_VERSION` ne changent pas : à confirmer par le responsable avant la mise en production. La raison montrée par iOS est `NSLocationWhenInUseUsageDescription` dans `apps/mobile/app.config.ts` ; Expo Go montre la sienne.
- **Journal des événements de visite (#156).** Chaque étape d'une visite (scan, ouverture de la barrière, boucle, allée détectée, place présumée ou confirmée, annulation) est inscrite avec la plaque, les heures, l'allée détectée et la place, et purgée 90 jours après chaque événement ; jamais d'adresse courriel, de carte ni d'identifiant de paiement (`docs/decisions/035`). Cela reste dans l'avis actuel (stationnement, plaque, heures) : `PRIVACY_NOTICE_VERSION` ne change pas.

## Hors de cet avis

- L'évaluation des facteurs relatifs à la vie privée (Loi 25) est un document distinct.
- La purge après 90 jours est la partie de #80, non de #31.
- Les conducteurs sans compte (`identity_kind = WEB`) ne sont pas couverts ici.
