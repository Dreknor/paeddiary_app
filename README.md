# paedDiary-App

Mobile App (iOS/Android, Smartphone & iPad) für Pädagogisches Tagebuch, Diagnose und Graduierung.
Backend: Laravel-Projekt `mitarbeiter.local` (API v1.1, `resources/api-docs/openapi-v1.yaml`).

## Dokumente
- [Konzept v2](docs/01-konzept.md)
- [Backend-Aufgaben](docs/02-backend-aufgaben.md) – B1–B7 sind im Backend umgesetzt
- [Regeln für KI-Agenten](AGENTS.md)

## Stack
Expo SDK 57 (React Native 0.86, TypeScript) · Expo Router · TanStack Query (verschlüsselt persistiert) ·
expo-secure-store · expo-local-authentication · expo-camera · expo-speech-recognition · EAS Build/Update

## Funktionsstand

| Bereich | Stand |
|---|---|
| Serverwahl | Adresse eingeben, QR-Code aus dem Web-Profil scannen, Deep Link `paeddiary://connect?server=…` |
| Anmeldung | Passwort und SSO (Keycloak über Backend, PKCE); App-Sperre mit Face ID/Fingerabdruck/Code, Sichtschutz |
| Offline | Gelesene Daten verschlüsselt zwischengespeichert (7 Tage); Schreibvorgänge über Warteschlange mit `Idempotency-Key`, automatisches Nachsenden, Anzeige „nicht übertragen“ |
| Klassen/Lerngruppen | Kachelansicht (Smartphone/iPad), Suche, Hinweis „lange kein Eintrag“, Mehrfachauswahl |
| Tagebuch | Einzel- und Gruppeneintrag (auch klassenübergreifend), Kategorien, Datum, vertraulich, offene Notiz, Diktat (auf dem Gerät), Bearbeiten mit Konfliktschutz, Löschen, Liste mit Filter |
| Graduierung | Einzel- und Gruppensession, schülerweise/fragenweise, Lehrerbewertung 1–5 + Kommentar, Abschluss mit Stufenvergabe, Verlauf |
| Selbsteinschätzung | iPad weitergeben (gesperrter Schülermodus) und eigene Schüler-iPads per QR-Code, Fragenfreigabe, Live-Fortschritt |
| Diagnose | Bereich/Stufe, Ampel je Kriterium, ⭐ aktuelles Ziel, Entwicklungsziele, Zwischenspeichern/Abschließen, offene Sitzungen fortsetzen, Zielstatus ändern |
| Dossier | Zeitraum, Präsentationsmodus fürs Elterngespräch, PDF (serverseitig) teilen/drucken |
| Einstellungen | Warteschlange, eigene Geräte abmelden, Abmelden mit Datenlöschung |

## Entwicklung

```bash
npm install
npm start          # Metro; Expo Go (ohne Diktat) oder Development Build
npm run check      # TypeScript + ESLint
npm run format     # Prettier
```

**Lokales Backend testen:** Das Gerät kann `mitarbeiter.local` nicht auflösen – in der App die LAN-IP
des Rechners eingeben (z. B. `http://192.168.1.20`). SSO aus Expo Go benötigt zusätzlich die Expo-Go-Rücksprung-URL
in `PAED_APP_REDIRECT_URIS` des Backends; im Development Build gilt `paeddiary://auth`.

**Development Build** (nötig für Diktat und für die finale Kamera-/SSO-Prüfung):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios   # erst mit Apple-Developer-Konto
```

Test-APK für Pilotgeräte: `--profile preview`. Store-Build: `--profile production`.

## Offene Punkte
- Bundle-ID/Package `de.ezr.paeddiary` ist vorläufig – vor dem ersten Store-Upload festlegen.
- Relution: Serveradresse per Managed App Configuration vorbelegen (benötigt natives Modul, noch nicht eingebaut).
- Automatisierte Tests (Jest/Maestro) fehlen noch.
