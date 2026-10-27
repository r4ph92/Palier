# 001 — Pile de l'API et de l'app

**Contexte.** Le dossier impose une API TypeScript en couches, Postgres et React Native (Q28, Q29), sans nommer de cadriciel, d'ORM, d'outil de tests ni de version de Node.

**Décision.** Monorepo npm workspaces. API : Fastify 5 + Drizzle ORM + postgres-js, exécutée par Node 24 sans étape de build. App : Expo SDK 58 avec génération native continue (`app.config.ts` seule source, `ios/` ignoré), Expo Go tant qu'aucun module natif n'existe. Types partagés dans `packages/shared-types`, types seulement.

**Conséquences.** Node 24 obligatoire (Expo 58 refuse Node 25). La story des balises (P03) passera à `expo-dev-client` et exigera CocoaPods. Le schéma de réponse Fastify est vérifié à la compilation contre le type partagé : un champ oublié casse `tsc`.
