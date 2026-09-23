# Pädagogen-App – Konzept v2

Stand: 2026-09-23 · Basis: `mitarbeiter.local/resources/api-docs/openapi-v1.yaml` + Antworten der Schule

## 1. Rahmenbedingungen (geklärt)

| Thema | Entscheidung / Stand |
|---|---|
| Geräte | Primär **dienstliche iPads** (MDM **Relution**), sekundär private Smartphones (iOS/Android) |
| Server | **Eigener Server je Schule** → App muss mit beliebig vielen Servern umgehen können |
| Klassen | 20–30 Schüler, **jahrgangsgemischte Lerngruppen** aus mehreren Klassen |
| Bundesland | **Sachsen** |
| Login | **SSO bevorzugt**: Web nutzt bereits Keycloak (UCS@school) via Socialite; Passwort-Login als Fallback |
| Datenhaltung | **Server ist führend.** Lokal nur Cache + Warteschlange für Unterbrechungen |
| Graduierung | Einzel- **und Gruppensessions** in der App; Selbsteinschätzung auf Lehrer-iPad (herumreichen) **und** auf eigenen Schüler-iPads; Modus **schülerweise** (`by_student`) und **fragenweise** (`by_question`) |
| Tagebuch | Keine Textbausteine, keine Anhänge, keine Erinnerungen – aber **Speech-to-Text** |
| Dossier | Bildschirmansicht **und** PDF mit Schul-Logo |
| Design | Vorhandenes Corporate Design wird übernommen |
| Stores | Google-Konto vorhanden, **Apple-Konto fehlt** |
| Entwicklung | Kein Mobile-Know-how im Team → Umsetzung überwiegend **KI-gestützt** |
| Termin | **Spätestens in 1 Monat** |

## 2. Technologie-Entscheidung (angepasst)

**Empfehlung: React Native mit Expo (TypeScript)** statt Flutter.

Begründung für *diese* Situation:
- **iOS-Builds in der Cloud (EAS Build)** – kein Mac nötig, Signierung wird verwaltet.
- **OTA-Updates (EAS Update)** – Fehlerbehebungen ohne erneute Store-Prüfung; bei 1 Monat Frist entscheidend.
- TypeScript ist näher am Web-/Laravel-Umfeld und von KI-Werkzeugen sehr gut abgedeckt.
- Fertige Module für alles Benötigte:

| Zweck | Paket |
|---|---|
| Navigation, iPad-Split-View | `expo-router` |
| Server-State, Cache, Retry | `@tanstack/react-query` + Persistenz in SQLite |
| Lokaler Cache / Warteschlange | `expo-sqlite` (verschlüsselt via SQLCipher-Option) |
| Token-Speicher | `expo-secure-store` (Keychain/Keystore) |
| App-Sperre | `expo-local-authentication` (Face ID / Fingerabdruck / Geräte-PIN) |
| SSO | `expo-auth-session` / `expo-web-browser` (System-Browser, PKCE) |
| Speech-to-Text | `expo-speech-recognition` mit **On-Device-Erkennung** (keine Cloud) |
| QR-Scan (Serverwahl, Schüler-Beitritt) | `expo-camera` |
| PDF anzeigen/teilen | `expo-sharing` / `expo-file-system` (PDF wird serverseitig erzeugt) |
| Bildschirmschutz | `expo-screen-capture` (kein Screenshot/App-Switcher-Vorschau) |

## 3. Mehrere Schulen / Serverwahl

Beim ersten Start wird der Server bestimmt – drei Wege, in dieser Reihenfolge:
1. **Relution Managed App Configuration**: Server-URL wird per MDM vorgegeben → Lehrkraft sieht direkt den Login ihrer Schule (Zero-Touch).
2. **QR-Code** aus dem Web-Profil („App verbinden“) scannen.
3. **Domain manuell eingeben** (z. B. `mitarbeiter.meine-schule.de`).

Die App ruft dann `GET /api/v1/instance` (neu, siehe Backend-Aufgabe B1) ab: Schulname, Logo, Farben, verfügbare Login-Arten, minimale App-Version. Oberfläche übernimmt Logo und Primärfarbe der Schule.

## 4. Anmeldung

- **SSO (Standard):** Button „Mit Schulkonto anmelden“ → System-Browser → bestehender Keycloak-Login des Laravel-Backends → Rücksprung in die App mit Einmal-Code → Tausch gegen Sanctum-Token (Backend-Aufgabe B2). Vorteil: **keine Änderung an Keycloak/UCS nötig**, das Backend nutzt seinen vorhandenen OIDC-Client.
- **Passwort (Fallback):** bestehendes `POST /auth/token`.
- Danach: Token im Keychain, App-Sperre per Biometrie/PIN, automatische Sperre nach 5 Min. im Hintergrund (auf privaten Geräten nicht abschaltbar).
- Abmelden widerruft das Token und löscht den lokalen Cache.

## 5. Datenfluss: Server führend, Cache für Unterbrechungen

```
Lesen:   Anzeige aus Cache (sofort) → Abgleich mit Server im Hintergrund → Server-Stand gewinnt
Schreiben: Server-Aufruf mit Idempotency-Key
           ├─ Erfolg → Cache aktualisieren
           └─ Netzfehler → in Warteschlange, Anzeige "⟳ wird übertragen", automatische Wiederholung
                           bei 4xx → Eintrag markieren "⚠ nicht gespeichert", Nutzer entscheidet
```

- Jeder schreibende Aufruf trägt einen `Idempotency-Key` (UUID) → Wiederholungen erzeugen keine Dubletten (Backend-Aufgabe B3).
- Nicht übertragene Einträge sind in „Offen“ sichtbar; Abmelden ist nur nach Rückfrage möglich, solange die Warteschlange nicht leer ist.
- Konflikte: Server gewinnt. Bei Bearbeitung eines zwischenzeitlich geänderten Eintrags → Hinweis + Neuladen (Backend-Aufgabe B6).
- Cache-Umfang: nur zugewiesene Klassen/Lerngruppen. Auf privaten Geräten: Cache-Löschung nach 14 Tagen ohne Anmeldung.

## 6. Funktionen

### 6.1 Klassen & Lerngruppen
- Umschalter **Klasse ↔ Lerngruppe**. Lerngruppe = Vereinigung der Klassenlisten aus `learning_groups[].class_ids`, Anzeige mit Klassenkürzel am Namen.
- Kachel: Initialen, Name, Graduierungs-Badge, aktive Ziele, Punkt „seit 14 Tagen kein Eintrag“ (rein visuell, keine Benachrichtigung).
- Mehrfachauswahl → Gruppeneintrag oder Gruppen-Graduierung.

### 6.2 Pädagogisches Tagebuch
- Schnellerfassung wie in v1 (Schüler → Kategorie → Text → Speichern).
- **Mikrofon-Taste** im Textfeld: On-Device-Diktat, Text erscheint live und bleibt editierbar. Auf dem iPad zusätzlich Apple-Pencil-Scribble (systemseitig).
- Gruppeneintrag über Lerngruppe: API legt je Klasse einen Eintrag an – die App zeigt das transparent („2 Einträge für 4a und 4b angelegt“).
- Vertraulich-Schalter, offene Notizen, Bearbeiten/Löschen nach Rechten.

### 6.3 Diagnose
- Wie v1: Bereich → Stufe → Kriterien mit Ampel per Tipp, ⭐ aktuelles Ziel, Entwicklungsziele.
- **Zwischenspeichern** mit `complete=false`. Geprüftes Backend-Verhalten:
  - Ampelbewertungen werden **zusammengeführt** (je Kriterium aktualisiert) ✅
  - Notizen werden **überschrieben** (ok – App sendet immer den vollständigen Text)
  - Entwicklungsziele werden bei jedem Aufruf **neu angelegt** ⚠️ → App sendet Ziele nur einmal; Backend-Aufgabe B3 (Idempotenz) sichert das zusätzlich ab.

### 6.4 Graduierung
**Einzelsession** (vorhanden) und **Gruppensession** (Backend-Aufgabe B4).

Ablauf Gruppensession:
1. Klasse/Lerngruppe → Schüler auswählen → Modus wählen:
   - **Schülerweise** (`by_student`): Kind A beantwortet alle Fragen, dann Kind B …
   - **Fragenweise** (`by_question`): Frage 1 für alle Kinder, dann Frage 2 …
2. Durchführungsart wählen:
   - **Lehrer-iPad herumreichen** → App wechselt in den **Schülermodus**: nur aktuelle Frage, Name des Kindes, 5 große Symbole für die Selbsteinschätzung, „Weiter an …“-Hinweis mit dem Namen des nächsten Kindes. Beenden nur per Biometrie/PIN der Lehrkraft.
   - **Eigene Schüler-iPads** → Lehrkraft zeigt je Kind einen **QR-Code** (oder druckt QR-Karten). Das Kind scannt ihn in der App („Ich bin Schüler“) und sieht **nur** seine Fragen der laufenden Session (Backend-Aufgabe B5). Im Modus *fragenweise* gibt die Lehrkraft die nächste Frage frei; die Schüler-iPads zeigen „Warte auf die nächste Frage…“.
3. **Live-Übersicht** für die Lehrkraft: Matrix Schüler × Fragen mit Status (offen / Selbsteinschätzung da / Lehrerbewertung da), Aktualisierung alle 3 s.
4. Lehrerbewertung (1–5) und Kommentar je Kind/Frage, dann **Abschluss je Kind** mit Stufenvergabe (nur mit `manage_grading`).

Schüler-iPads (Relution, geteilt): App wird mit Konfiguration `mode=student` ausgerollt → startet direkt im Beitrittsbildschirm, kein Lehrer-Login möglich. Empfehlung: in Relution **Einzel-App-Modus** während der Stunde.

### 6.5 Dossier
- Bildschirmansicht (Abschnitte, Kategorie-Diagramm, Zeitleisten) + **Präsentationsmodus** für Elterngespräche (vertrauliche Einträge ausgeblendet).
- **PDF serverseitig** (Backend-Aufgabe B7, dompdf ist bereits im Projekt) mit Schul-Logo → in der App anzeigen, teilen, drucken.

## 7. Datenschutz (Sachsen)

- **DSFA** des Web-Systems um die App ergänzen: neue Aspekte sind mobile Endgeräte, lokaler Cache, Diktat, Schülergeräte.
- **Private Geräte:** Die Verarbeitung von Schülerdaten auf privaten Geräten braucht nach den sächsischen Vorgaben zum Schuldatenschutz eine **Genehmigung**. Die genauen Bedingungen klärt die/der Datenschutzbeauftragte. Technisch sichert die App ab: Sperre ist Pflicht, Cache verschlüsselt, Auto-Löschung, keine Screenshots, Fernabmeldung über die Geräteliste im Web (B6).
- **Diktat ausschließlich on-device**. Auf Geräten ohne On-Device-Modell wird die Mikrofon-Taste ausgeblendet statt auf Cloud-Erkennung auszuweichen.
- **Schülermodus:** Die Kinder sehen nur die Fragen und ihren Vornamen. Das Token ist auf die Session beschränkt und läuft ab.
- Crash-Reporting ohne personenbezogene Daten (oder ganz weglassen im MVP).

## 8. Verteilung

| Plattform | Empfehlung |
|---|---|
| iOS | **Apple Developer Program als Organisation** beantragen (**sofort** – D-U-N-S-Nummer nötig, Dauer 1–3 Wochen). Verteilung als **„Unlisted App“** im App Store: nicht auffindbar, aber per Link installierbar → funktioniert für Relution-iPads (App-Store-App zuweisen) **und** private iPhones. Test vorab per **TestFlight**. |
| Android | **Google Play** (öffentlich oder geschlossener Test-Track). Die App ist ohne Schulserver nutzlos, daher ist eine öffentliche Listung unkritisch. Private APK nur als Notlösung. |

Eine App für alle Schulen, Mandantentrennung über die Serverwahl.

## 9. Zeitplan (4 Wochen) – ehrliche Einschätzung

Alle Funktionen in 4 Wochen, KI-gestützt und ohne Mobile-Erfahrung: **Das geht nur mit klarer Priorisierung.** Kritischer Pfad ist das **Apple-Konto**.

| Woche | App | Backend | Organisation |
|---|---|---|---|
| 1 | Projekt-Setup, Design-Tokens, Serverwahl, Passwort-Login, Klassen/Lerngruppen, Schülerprofil | B1, B2 (SSO), B3 (Idempotenz) | **Apple-Konto beantragen**, DSB informieren |
| 2 | Tagebuch komplett inkl. Diktat, Cache/Warteschlange, SSO-Login | B4 (Gruppensessions), B6 | Pilot-Lehrkräfte benennen, Android-Testversion |
| 3 | Graduierung (Einzel/Gruppe, Herumreichen, beide Modi), Diagnose | B5 (Schüler-Beitritt), B7 (PDF) | TestFlight, sobald das Apple-Konto da ist |
| 4 | Schüler-iPad-Modus, Dossier, Fehlerbehebung, Store-Einreichung | Tests, OpenAPI-Doku | Pilot in 2–3 Klassen, Relution-Konfiguration |

**Muss (Termin):** Login (SSO + Passwort), Klassen/Lerngruppen, Tagebuch mit Diktat, Graduierung auf dem Lehrer-iPad (Einzel/Gruppe, beide Modi), Diagnose.
**Kann nachgeliefert werden (+2–3 Wochen):** eigene Schüler-iPads (B5), Dossier-PDF, Präsentationsmodus.

## 10. Risiken

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| Apple-Konto/D-U-N-S dauert zu lange | Kein iOS-Test/Release | Heute beantragen; bis dahin mit Android und dem iOS-Simulator entwickeln |
| KI-Code ohne Mobile-Review | Instabilität | Kleine Aufgaben mit Abnahmekriterien, automatisierte Tests, Pilot vor Rollout |
| SSO-Rücksprung in die App (Redirect) | Login geht nicht | Frühzeitig in Woche 1 umsetzen und auf echtem Gerät testen |
| Schul-WLAN | Datenverlust | Warteschlange + Idempotenz (B3) |
| Store-Prüfung | Verzögerung | Demo-Zugang/Demo-Server für die Apple-Prüfung bereitstellen |
