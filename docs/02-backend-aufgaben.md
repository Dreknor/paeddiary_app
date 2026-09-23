# Backend-Aufgaben für die Pädagogen-App (Laravel, `mitarbeiter.local`)

Diese Aufgaben sind so formuliert, dass sie einzeln an einen KI-Coding-Agenten übergeben werden können.
Jede Aufgabe = ein eigener Branch / Pull Request.

## Gemeinsame Regeln (jeder Aufgabe voranstellen)

- Projekt: Laravel 10, Sanctum 3, Socialite Keycloak (`socialiteproviders/keycloak`), dompdf vorhanden.
- API v1: Routen in `routes/api.php` (Prefix `v1`, Name `api.v1.`), Controller in `app/Http/Controllers/API/v1/`, Resources in `app/Http/Resources/API/v1/`.
- Bestehendes Verhalten der Endpunkte darf **nicht brechen** (App und ggf. andere Clients). Nur additive Änderungen.
- Rechteprüfung wie in den bestehenden v1-Controllern (`view paed diary` als Grundrecht, Klassen über `klasse_user`).
- Fehlerformat: `{"message": "...", "errors": {...}}`.
- **Pflicht:** Feature-Tests unter `tests/Feature/API/` (Erfolgsfall, fehlende Rechte 403, Validierung 422, fremde Klasse), `php artisan test` grün.
- **Pflicht:** `resources/api-docs/openapi-v1.yaml` und die API-README aktualisieren.
- Migrationen sind rückwärtskompatibel und haben eine `down()`-Methode.

---

## B1 – Instanz-Info für die Serverwahl  · Priorität: hoch · Aufwand: S

**Ziel:** Die App kann nach Eingabe einer Domain oder per QR-Code prüfen, ob dort ein kompatibler Server läuft, und die Schule anzeigen.

**Umsetzung:**
- Öffentlicher Endpunkt `GET /api/v1/instance` (ohne Auth, Rate-Limit 30/min).
- Antwort:
```json
{
  "name": "Grundschule Musterstadt",
  "logo_url": "https://…/logo.png",
  "primary_color": "#1E40AF",
  "api_version": "1.1.0",
  "min_app_version": "1.0.0",
  "auth": { "password": true, "sso": true, "sso_label": "Mit Schulkonto anmelden" }
}
```
- Werte aus vorhandenen Einstellungen/Config ziehen (Schulname, Logo). `sso` = true, wenn die Keycloak-Config gesetzt ist. `password`-Login per Config abschaltbar (`PAED_APP_PASSWORD_LOGIN=true`).
- Im Web-Profil eine Kachel **„App verbinden“** mit QR-Code, Inhalt: `paeddiary://connect?server=https://<domain>`.

**Abnahme:** Aufruf ohne Token liefert 200 mit obigem Schema; keine personenbezogenen Daten in der Antwort; QR-Code wird im Profil angezeigt.

---

## B2 – SSO-Login für die App (Keycloak via Backend)  · Priorität: hoch · Aufwand: M

**Ziel:** Nutzer mit Schulkonto (UCS@school/Keycloak) erhalten ein Sanctum-Token, **ohne** dass an Keycloak etwas geändert werden muss. Das Backend nutzt seinen vorhandenen OIDC-Login (`app/Http/Controllers/Auth/KeycloakLoginController.php`, `SsoController.php`).

**Ablauf (Authorization Code + PKCE zwischen App und Backend):**
1. App öffnet im System-Browser:
   `GET /api/v1/auth/sso/start?redirect_uri=paeddiary://auth&code_challenge=<S256>&code_challenge_method=S256&state=<random>`
2. Backend prüft `redirect_uri` gegen Whitelist (`config('paed_app.redirect_uris')`, Standard `paeddiary://auth`), legt `code_challenge`, `redirect_uri`, `state` in die Session und startet den **bestehenden** Keycloak-Redirect.
3. Im bestehenden Callback: Wenn die Session einen App-Login markiert, **nach** erfolgreicher Nutzerzuordnung (gleiche Logik wie Web-Login, inkl. „Login nicht gestattet“-Fällen) einen Einmal-Code erzeugen (32 Byte zufällig, im Cache gespeichert als Hash, 60 s gültig, einmal verwendbar, gebunden an User-ID und `code_challenge`) und auf `paeddiary://auth?code=<code>&state=<state>` weiterleiten. Kein Web-Login-Cookie für diesen Fall zurücklassen.
4. App ruft `POST /api/v1/auth/sso/exchange` mit `{code, code_verifier, device_name}` auf → Backend prüft `SHA256(code_verifier)` gegen die Challenge, löscht den Code, prüft `view paed diary` und stellt ein Token **identisch zu `POST /auth/token`** aus (gleiche Antwortstruktur, 201).
- Fehlerfälle: abgelaufener/benutzter Code → 422 `code`; falscher Verifier → 422; fehlendes Recht → 403; Fehler beim Keycloak-Login → Weiterleitung `paeddiary://auth?error=<code>&state=<state>`.
- Rate-Limit auf `exchange`: 10/min pro IP.

**Abnahme:** Test mit gemocktem Socialite-User: start → callback → Redirect enthält code+state → exchange liefert Token; zweiter exchange mit gleichem Code 422; falscher Verifier 422; nicht erlaubte redirect_uri 422; normaler Web-Login unverändert.

---

## B3 – Idempotenz für schreibende API-Aufrufe  · Priorität: hoch · Aufwand: M

**Ziel:** Wiederholt die App einen Aufruf nach einem Netzabbruch, entstehen **keine Dubletten** (Tagebuch, Gruppeneinträge, Diagnose-Ziele, Graduierungsantworten).

**Umsetzung:**
- Middleware `idempotent` für alle `POST`/`PUT`/`DELETE`-Routen in API v1 (außer `auth/*`).
- Header `Idempotency-Key` (UUID, optional – ohne Header Verhalten wie bisher).
- Tabelle `api_idempotency_keys`: `id, user_id, key, method, path, request_hash (sha256 des Bodys), response_status, response_body (json), created_at`; Unique-Index `(user_id, key)`.
- Gleicher Key + gleicher Hash → gespeicherte Antwort unverändert zurückgeben (Header `Idempotent-Replayed: true`).
- Gleicher Key + anderer Hash → **422** `{"message": "Idempotency-Key wurde mit anderen Daten verwendet."}`.
- Gleichzeitige Anfrage mit gleichem Key, während die erste noch läuft → **409**. Umsetzung per Cache-Lock.
- Nur Antworten 2xx speichern. Aufräumen nach 48 h über den Scheduler (`php artisan paed-app:prune-idempotency`).

**Abnahme:** Doppelter `POST /paed-diary/entries` mit gleichem Key → 1 Eintrag, zweite Antwort identisch; Diagnose-POST mit `goals` zweimal gesendet → Ziele nur einmal angelegt; ohne Header unverändert.

---

## B4 – Gruppen-Graduierungssessions in der API  · Priorität: hoch · Aufwand: M–L

**Ziel:** Gruppensessions (heute nur im Web, `GradingDocumentationController`) in der App anlegen, auflisten, fortsetzen und bewerten – inkl. Modus `by_student` / `by_question` (`GradingDocumentationSession::ANSWER_ORDER_MODES`).

**Vorgehen:** Zuerst die Web-Logik (`GradingDocumentationController` Zeilen ~60–120 und ~630–670) in einen Service extrahieren (z. B. `App\Services\GradingSessionService`), damit Web und API dieselbe Logik nutzen. Das Web-Verhalten bleibt unverändert.

**Endpunkte:**
- `POST /api/v1/grading/sessions` erweitern (abwärtskompatibel):
  - bisher: `{schueler_id}` → Einzelsession (unverändert)
  - neu: `{type: "group", class_id, schueler_ids: [..], answer_order_mode: "by_student"|"by_question"}`. `schueler_ids` dürfen aus mehreren Klassen einer Lerngruppe stammen, wenn das Datenmodell das zulässt – **vorher prüfen und in der PR beschreiben**. Andernfalls ist `class_id` Pflicht und alle Schüler gehören zu dieser Klasse.
  - Eigene offene Gruppensession für dieselbe Klasse existiert → fortsetzen (200, `meta.resumed=true`), wie im Web.
- `GET /api/v1/classes/{class_id}/grading/sessions?status=open|completed` → Liste (ohne Fragen/Antworten, mit `progress: {answered, total}`).
- `PATCH /api/v1/grading/sessions/{id}` → `{answer_order_mode}` ändern (nur Ersteller, nicht abgeschlossen).
- `POST /grading/sessions/{id}/assessments`: bei Gruppensessions `schueler_id` Pflicht (bereits dokumentiert). `finalize` schließt **nur diesen Schüler** ab bzw. vergibt dessen Stufe. Die Session gilt als abgeschlossen, wenn alle Schüler finalisiert sind. Verhalten an Web angleichen und dokumentieren.
- `GET /grading/sessions/{id}` liefert zusätzlich `meta.students` (id, firstname, lastname-Initiale, finalized) und `meta.current_question_id` (für `by_question`, siehe B5).

**Abnahme:** Gruppensession anlegen, beide Modi, Antworten für 2 Schüler speichern, einen finalisieren (Stufenwechsel + Historie + Tagebucheintrag wie bei Einzelsession), Liste zeigt Fortschritt; Web-Oberfläche funktioniert unverändert (bestehende Tests grün).

---

## B5 – Selbsteinschätzung auf Schüler-iPads (Beitritt per QR)  · Priorität: mittel · Aufwand: L

**Ziel:** Schüler geben auf eigenen (geteilten) iPads **nur ihre Selbsteinschätzung** für eine laufende Session ab – ohne eigenes Konto und ohne Zugriff auf andere Daten.

**Lehrkraft-Endpunkte (Auth wie gehabt, nur Ersteller der Session):**
- `POST /api/v1/grading/sessions/{id}/join-codes` → erzeugt je Schüler der Session einen Code:
  `[{schueler_id, firstname, code: "K7M-4QX", qr_payload: "paeddiary://join?server=…&code=K7M4QX", expires_at}]`
  Code: 6 Zeichen ohne verwechselbare Zeichen, gültig bis Session-Ende, max. 8 h.
- `DELETE /api/v1/grading/sessions/{id}/join-codes` → alle Codes und Schüler-Tokens widerrufen.
- `POST /api/v1/grading/sessions/{id}/current-question` → `{question_id}` (nur Modus `by_question`: gibt die Frage für alle Schüler frei).

**Schüler-Endpunkte (öffentlich bzw. Schüler-Token):**
- `POST /api/v1/student/join` `{code, device_name}` (Rate-Limit 10/min pro IP) → Sanctum-Token **mit Ability** `student-grading:{session_id}:{schueler_id}`, Ablauf wie der Code. Antwort: `{token, student: {firstname}, session: {id, answer_order_mode}}`. Das Token gehört technisch dem Session-Ersteller oder einem dedizierten Modell `GradingStudentDevice` – **Entscheidung in der PR begründen**. Ein Token mit dieser Ability darf **ausschließlich** die folgenden Routen aufrufen (Middleware `ability:`, und alle übrigen v1-Routen lehnen solche Tokens ab):
- `GET /api/v1/student/session` → Fragen (bei `by_question` nur bis `current_question_id`), eigene bisherige `self_rating`s, `waiting: bool`.
- `POST /api/v1/student/session/answers` `{question_id, self_rating (1–5)}` → schreibt **nur** `self_rating` des eigenen Schülers; `rating_value`/`comment` sind unzugänglich.
- Session abgeschlossen oder Codes widerrufen → Tokens ungültig (401).

**Abnahme:** Schüler-Token kann keine anderen v1-Endpunkte aufrufen (403 auf `/classes`, `/students/*`); `by_question` liefert nur freigegebene Fragen; Lehrkraft sieht Selbsteinschätzungen in `GET /grading/sessions/{id}`; Codes laufen ab; Rate-Limit greift.

---

## B6 – Token-Laufzeit, Geräteliste, Konfliktschutz  · Priorität: mittel · Aufwand: S–M

**Ziel:** Verlorene/private Geräte können abgemeldet werden; parallele Bearbeitung überschreibt keine Daten unbemerkt.

**Umsetzung:**
- App-Tokens erhalten `expires_at` = jetzt + 90 Tage (Config `PAED_APP_TOKEN_DAYS`). Bei jeder Nutzung wird die Laufzeit auf 90 Tage verlängert, **höchstens einmal pro Tag** in die DB geschrieben.
- `GET /api/v1/auth/devices` → eigene Tokens `{id, device_name, last_used_at, created_at, is_current}`; `DELETE /api/v1/auth/devices/{id}`.
- Web-Profil: Liste „Meine App-Geräte“ mit Abmelden-Button.
- `PUT /paed-diary/entries/{id}` und `PUT /diagnostic/goals/{id}`: optionales Feld `expected_updated_at`. Weicht es vom DB-Wert ab → **409** mit aktuellem Datensatz in `data`.
- Login-Rate-Limit `POST /auth/token`: statt 6/min pro IP → 6/min pro (E-Mail + IP) und 60/min pro IP (viele Geräte im Schul-NAT).

**Abnahme:** Abgelaufenes Token 401; Gerät im Web abmelden → Token ungültig; PUT mit altem `expected_updated_at` → 409; ohne Feld unverändert.

---

## B7 – Dossier als PDF  · Priorität: mittel · Aufwand: M

**Ziel:** Das Dossier kann aus der App als PDF mit Schul-Logo angezeigt, geteilt und gedruckt werden.

**Umsetzung:**
- `GET /api/v1/students/{id}/dossier.pdf` mit den gleichen Parametern und Rechten wie `/dossier` (Logik in einen gemeinsamen Service ziehen, **keine** Doppelimplementierung).
- dompdf (`barryvdh/laravel-dompdf`), Blade-View `resources/views/pdf/dossier.blade.php`: Kopf mit Logo und Schulname, Schülername, Zeitraum, Erstelldatum und Ersteller; Abschnitte Tagebuch (nach Kategorie, mit Kategoriefarbe), Graduierung (aktuelle Stufe + Verlauf), Diagnose (Sitzungen, Ampel-Zusammenfassung, Ziele mit Status). Vertrauliche Einträge gekennzeichnet. Fußzeile „Vertraulich – nur für den dienstlichen Gebrauch“ + Seitenzahlen.
- Header `Content-Disposition: inline; filename="Dossier_<Nachname>_<Vorname>_<von>_<bis>.pdf"`, `Cache-Control: no-store`.
- Wenn möglich, dieselbe View für einen PDF-Export im Web nutzen.

**Abnahme:** PDF wird erzeugt (Test prüft Content-Type und Status); `include_confidential=false` blendet vertrauliche Einträge aus; ohne `view diagnostics` fehlt der Diagnoseteil; 60 Einträge erzeugen in < 5 s ein PDF.

---

## B8 – (optional) Delta-Abfragen & Katalog-Caching  · Priorität: niedrig · Aufwand: S

- `updated_since` (ISO-Datum/Zeit) auf `GET /students/{id}/paed-diary/entries` und `GET /students/{id}/diagnostic/history`.
- `ETag` + `If-None-Match` → 304 für `/paed-diary/categories`, `/diagnostic/areas`, `/grading/stages`.

---

## Reihenfolge

`B1 → B2 → B3 → B4 → B6 → B5 → B7 → (B8)`

## Vorlage für die Übergabe an den KI-Agenten

```
Arbeite im Laravel-Projekt /var/www/mitarbeiter.local.
Lies zuerst AGENTS.md, routes/api.php, resources/api-docs/openapi-v1.yaml
und die bestehenden Controller in app/Http/Controllers/API/v1/.
Setze die folgende Aufgabe um und halte dich an die "Gemeinsamen Regeln":
<Aufgabentext Bx einfügen>
Liefere: Code, Migrationen, Feature-Tests, aktualisierte OpenAPI-Doku
und eine kurze Zusammenfassung der Entscheidungen, die du treffen musstest.
```
