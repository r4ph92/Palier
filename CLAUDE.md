# Palier

Allocation de places en stationnement intérieur, multi-opérateurs: le conducteur voit la disponibilité, scanne un QR à la borne et repart sans billet ni terminal de paiement.

## Stack

TypeScript 6 on Node 24 (`.nvmrc`), npm workspaces. API: Fastify 5, Drizzle ORM, postgres-js, Postgres 17 in Docker on port 5433.
App: React Native with Expo SDK 58, iOS only, run in Expo Go. Tests: Vitest (API), Jest with `jest-expo` (app). Locales: fr default, en on an English device.

## Commands

| Purpose | Command |
|---|---|
| Install | `npm install` |
| Database up | `docker compose up -d --wait` |
| Migrate | `npm run db:migrate` |
| Seed personas | `npm run seed --workspace @palier/api` |
| Start API | `npm run start --workspace @palier/api` (URL: http://127.0.0.1:3000) |
| Start app | `npm run ios --workspace @palier/mobile` |
| Static gate | `npm run gate` |
| Tests | `npm run test:api`, `npm run test:mobile` |
| Database tests | `npm run test:db` (Docker required, outside the gate and CI) |
| New migration | `npm run db:generate --workspace @palier/api` |

`npm run gate` is lint, typecheck and unit tests only, and `.github/workflows/ci.yml` runs the same
steps. No integration or browser tests: `docs/decisions/002-tests-unitaires-seulement.md`. Both
`.env` files are required before the app can sign in: copy each `.env.example` beside it.

## Personas

Sign-in is the "Connexion de test" section of the Connexion screen, no password. The seed adds the
five drivers below plus Conducteur Test 01 to 20.

| Persona | Login | Role |
|---|---|---|
| Julie Tremblay | julie.tremblay@palier.test | Driver, consented to the notice |
| Marc Gagnon | marc.gagnon@palier.test | Driver, consented |
| Amélie Côté | amelie.cote@palier.test | Driver, consented |
| Éric Fortin | eric.fortin@palier.test | Driver, consented |
| Nadia Bouchard | nadia.bouchard@palier.test | Driver without consent, sees the notice first |

## Architecture

`apps/api/src` is `http/` (routes, validator), `domain/` (rules and ports) and
`infrastructure/postgres/` (schema, repositories), with `config/`, `migrate/` and `seed/` beside
them. `apps/mobile/src` holds the screens plus `api/`, `privacy/` and `theme/`, and `packages/shared-types`
carries what the two exchange. Layer map: `docs/04-architecture.html`. Choices taken while building:
`docs/implementation.md`. Design record: `DECISIONS.md` and `docs/decisions/`.

## Design

Direction: provisional, defined in `docs/design.md`. Build within its tokens, in `apps/mobile/src/theme/`.

## Project conventions

- Product text is French first, English second. Docs and decisions are written in French.
- Every new `/v1` route is added to `apps/api/test/unit/routeClassification.test.ts` as public, consent exempt or protected, or that test fails.
- The privacy notice version lives in `apps/api/src/domain/consent/privacyNotice.ts` and `apps/mobile/src/privacy/noticeVersion.ts`, changed together.
