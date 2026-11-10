# Seefüchse-App – Entwicklungskontext für KI-Assistenten

> Verbindlicher Entwicklungskontext für GitHub Copilot und neue Mitwirkende. Das README bleibt der kompakte Überblick für Menschen; hier stehen Architekturentscheidungen, Konventionen, Workarounds und der technische Stand.
> Stand: 10.11.2026.
> Hinweis: Abschnitte 4, 6 und 11 wurden am 10.11.2026 gegen den Code geprüft. Bei Abweichungen im Code gilt der Code, und diese Datei wird angepasst.

## 1. Projekt

Verwaltungstool für Dauerkarten-Freigaben des SC-Freiburg-Fanclubs „die Seefüchse" (Bodensee-Region, ca. 28 Mitglieder, 12 Dauerkarten + 2 Fanclubkarten). Es löst einen Excel-Workflow ab. Ursprung: Prototyping-Modul an der Uni („StadionTracker").

Kernmechanik: Ein DK-Besitzer gibt seinen Platz für ein Spiel frei → Mitglieder bewerben sich → der Besitzer entscheidet manuell, wer die Karte bekommt. Alle Mitglieder sehen verfügbare Karten. Benachrichtigungen sind rein In-App, kein E-Mail-Versand.

## 2. Tech-Stack (final, nicht zur Diskussion stellen)

- SvelteKit 5 mit Runes (`$props`, `$state`, `$effect`, `$derived`)
- PostgreSQL via Supabase (Frankfurt, eu-central-1) + Drizzle ORM (postgres-js-Driver, `prepare: false`, Transaction Pooler, Port 6543)
- Netlify Hosting (`adapter-netlify`)
- `@lucide/svelte` (**nicht** `lucide-svelte`, das ist deprecated)
- Leaflet.js (konkreter Einsatz noch offen)
- Custom CSS, mobile-first (375px Basis, 720px max. Desktop), Design-Tokens in `app.css`
- Fonts: Inter + JetBrains Mono
- VS Code + GitHub

Keine alternativen Frameworks/Libraries vorschlagen. Next.js/React ist bewusst zurückgestellt. Neue npm-Pakete nur nach Rücksprache.

## 3. Verbindliche Konventionen

- DK-Besitzer-Status wird zur Laufzeit abgeleitet (`dauerkarten.besitzer_id = user.id`), niemals als eigene Rolle gespeichert.
- Sämtlicher DB-Zugriff läuft server-seitig über Drizzle. `supabase-js` ausschließlich für Auth.
- Data API (PostgREST) ist bewusst deaktiviert, nur server-seitiges Drizzle.
- Postgres-Enum-Werte exakt einhalten:
  - `mitglieder.status`: `ausstehend` / `aktiv` / `abgelehnt`
  - `freigaben.status`: `offen` / `vergeben` / `zurueckgezogen`
  - `bewerbungen.status`: `angefragt` / `angenommen` / `abgelehnt`
- Defense-in-Depth: Autorisierung in jeder Server Action und jedem Endpoint prüfen, unabhängig von der UI-Sichtbarkeit.
- Race-Condition-Schutz über bedingte WHERE-Klauseln, nicht Read-then-Write.
- Drizzle Relational Queries statt manueller Joins bevorzugen.
- Gemeinsame Business-Logik gehört nach `src/lib/server/`, nicht dupliziert in einzelne `+page.server.ts`.
- Abgeleitete Werte zur Laufzeit berechnen statt redundant zu speichern (z. B. „Uhrzeit vorläufig").
- Durchgängig deutsche Benennung im Code (Tabellen, Variablen, Routen).
- `use:enhance` mit `requestSubmit()`-Pattern für Toggle-Formulare.
- Tests gegen die echte Datenbank nur in einer Transaktion, die am Ende zurückgerollt wird.
- Weicht ein Vorschlag von diesen Konventionen ab, das explizit benennen und begründen.

## 4. Datenmodell (Kurzfassung)

Tabellen: `mitglieder` (id = FK auf `auth.users.id`), `rollen`, `mitglied_rollen`, `dauerkarten`, `spiele`, `freigaben`, `bewerbungen`, `interesse`, `benachrichtigungen`, `push_abos`, `benachrichtigung_einstellungen`, `sync_laeufe`. Das ER-Diagramm unter `DB-stucture/` zeigt nur den Planungsstand der Kerntabellen; maßgeblich ist `schema.ts`.

- `dauerkarten`: `besitzer_id` und `bezeichnung` NOT NULL, `platz` optional; kein Block/Reihe (alle Karten im selben Block). Bei der Registrierung kann „Ich habe eine Dauerkarte" angehakt werden; dann legt `/registrieren` in derselben Transaktion wie das Mitglied eine Karte mit `besitzer_id = user.id` und `bezeichnung` „DK {Name}" an. Kontrolle durch den Vorstand in der Verwaltung.
- `interesse`: Interessensbekundung eines Mitglieds für ein Spiel ohne Freigabe, UNIQUE (`mitglied_id`, `spiel_id`). In Gebrauch (`src/lib/server/interesse.ts`, `/spielplan/[id]`, `/anfragen`, Zähler auf `/karte`).
- `benachrichtigungen`: In-App-Benachrichtigungen (Glocke), Typ-Enum `benachrichtigung_typ` (`neue_anfrage`, `anfrage_angenommen`, `anfrage_abgelehnt`, `karte_freigegeben`, `neues_interesse`), `gelesen_am` null = ungelesen. In Gebrauch (`src/lib/server/benachrichtigungen.ts`, `/benachrichtigungen`, Header).
- `push_abos` (Web-Push-Abo je Gerät) und `benachrichtigung_einstellungen` (Push an/aus je Mitglied und Typ, fehlende Zeile = an): nur im Schema, im Code noch nicht verwendet.

`spiele`: `id`, `datum` (date), `uhrzeit` (time without time zone, deutsche Ortszeit, nullable = noch unbekannt), `gegner`, `wettbewerb` (text), `heim_auswaerts` (Enum), `openligadb_id` (text, nullable, UNIQUE nur in der DB, siehe unten), `manuell_ueberschrieben` (boolean, Default false), `openligadb_aktualisiert_am` (timestamptz).

`sync_laeufe`: `id`, `gestartet_am`, `quelle` (`cron` | `manuell`), `saison`, `erfolgreich`, `neu`, `geaendert`, `unveraendert`, `uebersprungen` (im Sync-Ergebnis heißt das Feld `uebersprungenManuell`), `hinweise` (zeilenweise zusammengefügt, null = keine). Der CHECK auf `quelle` und der Index `sync_laeufe_gestartet_am_idx` existieren nur in der Datenbank. Einträge älter als 90 Tage (`PROTOKOLL_AUFBEWAHRUNG_TAGE`) werden nach jedem Lauf gelöscht.

**Schema-Änderungen werden manuell im Supabase SQL Editor angewendet, `schema.ts` wird von Hand nachgezogen.** Der UNIQUE-Index `spiele_openligadb_id_uniq` existiert nur in der Datenbank und ist in `schema.ts` nicht deklariert. Ein `drizzle-kit push` könnte ihn entfernen und den Sync-Upsert zerstören.

## 5. Rollen und Autorisierung

Drei Rollen (Admin, Vorstand, Mitglied), many-to-many über `mitglied_rollen`. Vorstand hat den gleichen Umfang wie Admin, außer „Rollen verwalten" (nur Admin). Die Prüfung läuft über `hatVerwaltungsRolle(userId)`, im `load()` und zusätzlich in jeder Action. `hooks.server.ts` enthält Auth-Session und Routen-Schutz; der Cron-Pfad `/api/cron/spielplan-sync` ist davon ausgenommen und über ein Token geschützt.

## 6. Spielplan-Sync

Quelle ist OpenLigaDB (kostenlos, ohne Auth, Community-gepflegt), kein Webscraping.

- Basis-URL: `https://api.openligadb.de/getmatchdata/{kürzel}/{saison}` (die Variante mit `www.` antwortet mit 301).
- Saison 2026/27: `bl1` → „Bundesliga", `dfb` → „DFB-Pokal", `uecl2026` → „Conference League" (Konstante `LIGEN`; das Conference-League-Kürzel steht dort als `uecl{saison}` und wird aus der Saison gebildet). Der Filter „Europa" im Spielplan umfasst Europa League und Conference League. Freiburg spielt 2026/27 in der Conference League; ein Kürzel `uel2026` existiert, wird aber nicht gebraucht.
- Liga-Kürzel sind saisonabhängig. **Beim Saisonwechsel (Sommer 2027)** `AKTUELLE_SAISON` und die Kürzel anpassen.
- Nur Spiele mit „SC Freiburg" (Konstante `EIGENES_TEAM`) werden übernommen.
- Mapping: `openligadb_id` = `matchID`; `datum`/`uhrzeit` per String-Split aus `matchDateTime` (lokale Zeit, keine Zeitzonen-Konvertierung); `lastUpdateDateTime` kommt ohne Zeitzone in deutscher Ortszeit und wird als Europe/Berlin-Zeit gespeichert.
- Upsert per `INSERT … ON CONFLICT (openligadb_id) DO UPDATE` mit `setWhere`: nur wenn `manuell_ueberschrieben = false` und sich `datum`, `uhrzeit`, `gegner`, `wettbewerb` oder `heim_auswaerts` tatsächlich ändert (`IS DISTINCT FROM`). Spiele, die in der API fehlen, werden nie gelöscht.
- Fehler pro Liga werden abgefangen, die anderen Ligen laufen weiter (`abrufFehler` zählt fehlgeschlagene Ligen, Details in `hinweise`; Timeout je Abruf 8 s, `ABRUF_TIMEOUT_MS`). Der Lauf gilt als erfolgreich, wenn `abrufFehler === 0` und das Protokoll geschrieben wurde.
- Terminänderungen (alter und neuer Wert, `terminAenderungen`) werden im Ergebnis geliefert, Grundlage für spätere Benachrichtigungen.

Code: `src/lib/server/spielplanSync.ts` (`synchronisiereSpielplan(saison)`, `fuehreSyncMitProtokollAus(quelle)`, `AKTUELLE_SAISON`, Typen `SyncErgebnis`, `SyncQuelle`). `fuehreSyncMitProtokollAus` nutzt immer `AKTUELLE_SAISON` und wirft nie.

**Manuelle Korrekturen:** `spielAendern` (`src/lib/server/spiele.ts`) setzt `manuell_ueberschrieben = true` im selben UPDATE, wenn das Spiel eine `openligadb_id` hat und sich `datum`, `uhrzeit`, `gegner`, `wettbewerb` oder `heim_auswaerts` ändert. Zurücksetzen geht bisher nur per SQL. Von Hand angelegte Spiele ohne `openligadb_id` erkennt der Sync nicht. Zuerst syncen, dann von Hand ergänzen.

**„Uhrzeit vorläufig":** Die DFL setzt Anstoßzeiten in Etappen fest, bis dahin trägt OpenLigaDB den Standard-Slot (Samstag 15:30). Der Terminierungs-Stichtag ist das späteste `datum` eines Bundesliga-Spiels, das nach dem Erstimport bearbeitet wurde (`openligadb_aktualisiert_am` > frühester Stempel + 1 Tag). Synchronisierte Bundesliga-Spiele (mit `openligadb_id`) ab heute, deren `datum` nach dem Stichtag liegt (oder wenn es noch keinen Stichtag gibt), gelten als vorläufig, außer sie sind manuell überschrieben. Wert wird zur Laufzeit abgeleitet, keine Spalte. Code: `src/lib/server/spielplanTermine.ts` (`ermittleTerminierungsStichtag`, `istUhrzeitVorlaeufig`, `mitUhrzeitVorlaeufig`). Die Verwaltung zeigt „Anstoßzeiten bestätigt bis: …".

### Automatischer Lauf

- Netlify Scheduled Function `netlify/functions/spielplan-sync-taeglich.mts`, Zeitplan `0 4 * * *` (UTC, also 05:00 bzw. 06:00 Uhr deutscher Zeit). Sie hat keine Imports aus `src/` und ruft nur per `fetch` den Endpoint auf (Basis-URL aus `process.env.URL`, sonst `SITE_BASE_URL`, Timeout 25 s).
- Endpoint `POST /api/cron/spielplan-sync` erwartet `Authorization: Bearer <CRON_SECRET>`. Fehlt das Secret: 503. Falsches oder fehlendes Token: 401. Andere HTTP-Methoden: 405. Vergleich zeitkonstant über SHA-256 (Web Crypto, ohne `@types/node`). Danach `fuehreSyncMitProtokollAus('cron')`.
- Der Button in `/verwaltung` ruft dieselbe Funktion mit `quelle = 'manuell'` auf (Rollenprüfung in der Action). Die Karte zeigt „Zuletzt synchronisiert" bzw. eine Warnung bei fehlgeschlagenem Lauf.
- Scheduled Functions laufen nur auf dem veröffentlichten Production-Deploy, nicht auf Deploy Previews. Zum Testen in Netlify unter Functions → „Run now". Lokal: `curl -X POST -H "Authorization: Bearer …" http://localhost:5173/api/cron/spielplan-sync`.

## 7. Deployment

- Live: https://seefuechse.netlify.app (Branch `main`, Auto-Publishing).
- Netlify-Umgebungsvariablen: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (als Secret markiert), `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (bewusst **nicht** als Secret markiert, sie landen im Browser-Code; sonst bricht das Secret-Scanning den Build ab). Notfalls Ausnahmen über `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` bzw. `SECRETS_SCAN_OMIT_KEYS`.
- Supabase Auth → URL Configuration: Site URL `https://seefuechse.netlify.app`; Redirect URLs `https://seefuechse.netlify.app/**` und `http://localhost:5173/**`.
- Lokale Entwicklung und Live-Seite nutzen **dieselbe Datenbank**.

## 8. Sicherheit

- Das Repo ist **öffentlich**. Nie Geheimnisse committen. `.env` ist in `.gitignore`; `.env.example` enthält nur Platzhalter.
- `SUPABASE_SERVICE_ROLE_KEY` ist ein Admin-Schlüssel und darf nie in Client-Code, Repo oder Chats.
- Das DB-Passwort wurde am 10.11.2026 zurückgesetzt, weil der erste Commit eine echte `DATABASE_URL` in `.env.example` enthielt. Der alte Wert in der Git-Historie ist wertlos.

## 9. Bekannte Probleme und Workarounds

- `drizzle-kit push` crasht bei Cross-Schema-FK auf `auth.users` (bestätigter Bug): Schema-Änderungen manuell im Supabase SQL Editor anwenden, `schema.ts` bleibt ein Abbild.
- Node v24 bricht `npm run check`, aber nicht den Dev-Server. Der Check zeigt aktuell 3 bekannte Fehler, die nicht zu den neueren Änderungen gehören.
- Firmennetz blockiert Supabase-DB-Ports: für `db:push`, `db:studio` und `npm run dev` mit Live-Queries den iPhone-Hotspot nutzen.
- Das Repo darf nicht in iCloud-synchronisierten Ordnern liegen (korrumpiert `node_modules` und `.git`).
- macOS Finder blendet Punkt-Ordner (`.github`) im GUI aus: Terminal oder VS Code nutzen.
- `.svelte-kit/tsconfig.json` fehlt nach frischem `npm install`: `npx svelte-kit sync`.
- Sonderzeichen im DB-Passwort (`%`, `^`, `)`) müssen in `DATABASE_URL` URL-encodet sein. Einfacher: Passwort nur aus Buchstaben und Ziffern.
- Vite muss `^6.0.0` sein (Peer-Dependency-Konflikt mit `@sveltejs/vite-plugin-svelte@5.x`).

## 10. Arbeitsweise

- Commit-Konvention `feat:` / `docs:` / `fix:` / `refactor:` mit Bullet-Body.
- Größere Schritte werden als strukturierter Prompt formuliert und in VS Code mit Copilot umgesetzt. Danach folgt eine Kontrolle durch den Entwickler.
- Bei Unsicherheit über den Implementierungsstand nachfragen statt annehmen.
- Antworten und Kommentare auf Deutsch.

## 11. Offene Punkte

Stand 10.11.2026, gegen den Code geprüft. Bereits fertig und daher **nicht** offen: Anfragen-Seite, Rollen-Verwaltungs-UI, NavBar mit „Anfragen" für alle, Interesse-Funktion, In-App-Benachrichtigungen (Anlegen beim Auslösen, Glocke mit Zähler, Liste, gelesen markieren; Zähler wird beim Seitenladen ermittelt, kein Realtime).

- Web-Push: Versand in `benachrichtigen()` (TODO im Code) und `push`-/`notificationclick`-Handler in `src/service-worker.ts` (auskommentiert) fehlen; `push_abos` und `benachrichtigung_einstellungen` sind ungenutzt.
- In-App-Benachrichtigung bei Datums- oder Uhrzeitänderung von Spielen mit Freigaben/Bewerbungen (der Sync liefert `terminAenderungen` bereits, angezeigt wird nur die Anzahl in `/verwaltung`).
- Dauerkarten-Zuordnung in `/verwaltung` (nur Platzhaltertext).
- Admin-UI zum Zurücksetzen von `manuell_ueberschrieben`.
- Mehrfach-Dauerkarten pro Besitzer: `/karte` und `/spielplan/[id]` nutzen `findFirst`, das Dashboard die erste Karte.
- Vorverkaufstermine (Heim/Auswärts) und Spielergebnisse: keine Spalten im Schema.
- Spielplan-UI: Badge-Farben (Auswärts neutral, Wettbewerbe farblich unterscheiden); der Filter-Chip „Testspiele" existiert.
- Leaflet ist installiert, aber nirgends eingebunden; Teststrategie offen, keine automatisierten Tests.
- Saisonwechsel 2027/28: `AKTUELLE_SAISON` und Liga-Kürzel anpassen.
