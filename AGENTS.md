# paedDiary-App – Projektregeln

Mobile App (iOS/Android, Smartphone + iPad) für Pädagogisches Tagebuch, Diagnose und Graduierung.
Fachliches Konzept: `docs/01-konzept.md`. Backend-Erweiterungen: `docs/02-backend-aufgaben.md`.

## Backend
- Laravel-Projekt unter `/var/www/mitarbeiter.local` (lokal: `http://mitarbeiter.local`). **Nicht in diesem Repo ändern.**
- API-Vertrag: `/var/www/mitarbeiter.local/resources/api-docs/openapi-v1.yaml` – Typen in `src/api/types.ts` danach ausrichten.
- Jede Schule hat einen eigenen Server; die App kennt keine feste URL (Serverwahl in `src/app/server.tsx`).

## Architektur
- `src/app/` – nur Routen (Expo Router). `(app)/` = angemeldeter Bereich, geschützt durch `Stack.Protected` + `AppLock`.
- `src/api/client.ts` – einziger Weg zum Server (`api.get/post/put/del`). Setzt Token, Timeout, `Idempotency-Key`, deutsche Fehlermeldungen (`ApiError`).
- `src/api/endpoints.ts` – ein Funktionsaufruf pro Endpunkt. `src/api/queries.ts` – TanStack-Query-Hooks + `queryKeys`.
- `src/auth/` – Sitzung (SecureStore), SSO (PKCE über Backend, Aufgabe B2), App-Sperre.
- `src/theme/` – Design-Tokens. Keine Farben/Abstände direkt im Code, immer `colors`, `spacing`, `font`, `radius`.
- `src/api/mutations.ts` – alle schreibenden Aktionen; laufen über die Warteschlange `src/sync/outbox.ts`
  (verschlüsselt gespeichert, Idempotency-Key = Auftrags-ID, automatisches Nachsenden).
- `src/sync/queryPersistence.ts` – gelesene Daten verschlüsselt persistieren (`meta: { persist: false }` für sensible Einmal-Abfragen wie Dossier).
- `src/lib/encryptedStore.ts` – AES-GCM-Dateiablage, Schlüssel im Keychain/Keystore.
- `src/components/` – wiederverwendbare Bausteine (`ui.tsx`, `controls.tsx`, `ActionSheet`, `Toast`, Fachkomponenten je Modul).
- `src/student/` + `src/app/schueler-modus/` – Schüler-iPad mit eigenem, eingeschränktem Token (nie mit Lehrer-Token mischen).

## Regeln
- Oberfläche komplett **Deutsch**, Du-Form, kurze Texte.
- Server ist führend; lokal nur Cache. Schreibende Aufrufe immer über `api.*` (Idempotency-Key).
- Keine Schülerdaten in Logs, Benachrichtigungen oder Crash-Reports.
- Rechte aus `user.permissions` bzw. `StudentView.permissions` steuern die Sichtbarkeit – nichts anzeigen, was der Nutzer nicht darf.
- Tippflächen ≥ `touchTarget` (48). Layouts müssen auf iPhone SE und iPad quer funktionieren (`useWindowDimensions`).
- Android-`Alert` hat max. 3 Knöpfe → für mehr Optionen `showActionSheet` verwenden.
- React-Compiler-Regeln beachten: kein `setState` synchron in Effekten, keine Ref-Zuweisung beim Rendern – Zustand ableiten.
- Vor „fertig“: `npm run check` fehlerfrei und `npm run format`.

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
