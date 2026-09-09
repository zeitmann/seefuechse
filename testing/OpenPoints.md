Aktuell:

Punkt 1:

Aufgefallene Punkte:
- Auf Spielplan-Seite, wenn man auf ein Spiel drückt und dort seine DK freigibt sollte dort bei dem Button noch "Dauerkarte freigeben" damit man weiss was der Button macht
- Funktionalität der oberen Leisten-Buttons (Glocke, Hamburger-Menü) noch implementieren.


Punkt 2: Meine Einschätzung + was es dafür braucht

Gute Nachricht zuerst: einiges davon ist schon da oder deutlich einfacher als gedacht.

a) Deine eigene DK als Admin verwalten – Kein Code nötig. DK-Besitz wird ja laut eurem Architekturprinzip zur Laufzeit aus dauerkarten.besitzerId abgeleitet, nicht aus der Rolle. Sobald du (Timon) bei der echten Mitglieder-/Karten-Migration eine dauerkarten-Zeile mit besitzerId = deine mitglied-id bekommst, siehst du auf /karte automatisch deine eigene Karte, genau wie jedes andere Mitglied mit DK. Reine Datenfrage, kein Feature.

Mein Kommentar: Okay, das funktioniert soweit, lassen wir so.

b) DK-Benennung + Nachvollziehbarkeit, wer eine Karte bekommen hat – Auch größtenteils schon da. dauerkarten.bezeichnung existiert bereits (aktuell "DK Chefe", "DK Christian" etc.) und jede freigaben-Zeile ist bereits ein historischer Datensatz pro Spiel mit vergebenAn – die Historie "welche Karte ging an wen für welches Spiel" ist also strukturell schon vollständig erfasst, ganz ohne Schema-Änderung. Was fehlt, ist nur eine Auswertungs-Seite/Statistik-View, die diese Daten aggregiert und anzeigt (z.B. "Holgers Karte ging dieses Jahr 5x an Tim, 2x an Stefan..."). Das ist reine Anzeige-Arbeit, kein DB-Umbau.

Mein Kommentar: Okay, merke dir für später, dass die die Statistik noch auswerten möchte auf einer Seite.

c) Sichtbarkeit, dass eine Karte frei ist – Größtenteils schon umgesetzt: das Start-Dashboard zeigt unter "Aktuell freie Karten" bereits Besitzername, Gegner, Datum und Bewerbungsstatus. Was noch fehlt: ob das auch auf der Spielplan-Detailseite (/spielplan/[id]) direkt beim jeweiligen Spiel sichtbar ist, inklusive Besitzername, damit man dort weiß, wen man kontaktieren muss. Müsste ich im Code noch prüfen, ob das schon existiert oder ergänzt werden muss.

Mein Kommentar: Okay auf dem Dashboard ist gut aber es sollte auch auf /spielplan/(id) sichtbar sein, es ist noch nicht umgesetzt. Bitte machen.

d) Sichtbarkeit der Bewerber – Aktuell nur für den DK-Besitzer selbst sichtbar (auf /karte). Falls du willst, dass auch andere sehen, wie viele sich schon beworben haben (nicht zwingend wer), ist das mit dem bestehenden applicationCount-Feld im Free-Cards-Bereich eigentlich schon teilweise gelöst – nur die Namen der Bewerber selbst sind aktuell nicht öffentlich, nur die Anzahl.

Mein Kommentar: Ja alle sollen sehen können wer seine Karte für dieses Spiel abgegeben hat und an wen. Damit man weiss wer sonst noch im Stadion sein wird und wer nicht. Bitte machen.

e) Generelles Interesse an einer Karte pro Spiel anmelden, unabhängig von einer aktiven Freigabe – Das ist der aufwändigste Teil und tatsächlich ein neues Feature, kein bestehender Mechanismus. Aktuell hängt eine bewerbung immer an einer existierenden freigabe – dein Wunsch ist aber, dass jemand schon bevor eine Karte freigegeben wurde, Interesse an einem bestimmten Spiel hinterlegen kann (quasi eine Warteliste). Das braucht:

Neue DB-Tabelle (z.B. interesse: id, mitglied_id, spiel_id, erstellt_am) – unabhängig von freigaben/bewerbungen
Neue UI auf /spielplan/[id]: Button "Interesse anmelden", sichtbar für alle Mitglieder (auch DK-Besitzer, siehe deine Tabelle oben)
Verknüpfungslogik: wenn ein DK-Besitzer später eine Karte für genau dieses Spiel freigibt, sollte er idealerweise sehen "3 Mitglieder haben schon Interesse angemeldet" – das braucht eine Abfrage, die interesse mit freigaben über spiel_id verknüpft
Perspektivisch verwandt mit eurer bereits angedachten Auswärtsspiel-Vorverkauf-Idee auf der Backlog-Liste – beide drehen sich um "Interesse vor tatsächlicher Verfügbarkeit anmelden", könnte man later zusammen denken

Kurz zusammengefasst, was Punkt 2 an echter Neu-Entwicklung braucht: vor allem Punkt (e) – eine neue Tabelle plus UI plus Verknüpfungslogik. Die Punkte (a)–(d) sind größtenteils "schon vorhanden, nur noch nicht überall sichtbar gemacht" bzw. reine Datenpflege.

ein Kommentar: Super, ja ich möchte das so umsetzen. 


Naher Zukunft:
- Möglichkeit im Kalender/Spielplan Einträge zu ändern, neue zu erfassen und zu löschen und das ganze nur für Admin und Vorstand. 

- Automatische Einträge:
    - Für Spieltermine sobald diese Online bekannt gegeben werden, zb. mit Webscraper oder besseren alternative.
    - Für Vorverkaufstermine für Tickets, Heim/Auswärts. Auswärts sicherlich wichtiger. Terminbekanntgabe per Mail von Sc Freiburg. Ticketshop und dann sollte es automatisch in der App eingetragen werden.
    - Spielergebnisse sollten nach dem Spiel immer so schnell wie möglich auch in die App eingetragen werden. Evt auch mit Webscrapping oder anderer alternative. Evt sollte auch manuell möglich sein. Durch Admin/Vorstand.

Zukunft:
Zweite Navbar-Variante für Mitglieder ohne Dauerkarte – ✅ erledigt (heute)
Spielplan-Sync via OpenLigaDB API (automatisch für bl1/bl2/bl3/dfb, Europa League weiterhin manuell)
Passwort-Reset-Flow – aktuell nur per SQL via pgcrypto/crypt() möglich
Echte Mitglieder-Datenmigration – 28 Mitglieder, 14 Karten aus Excel in die App übernehmen
Netlify-Deployment (inkl. Supabase-URL-Configuration-Anpassung, die wir vorhin schon vorgemerkt haben)
Dark/Light Mode Toggle – nach Kernfunktionalität, braucht eigenes CSS-Variablen-Konzept
Feature-Idee Auswärtsspiel-Vorverkauf (zwei Teile: automatisches Einlesen von VVK-Terminen aus Vorstand-E-Mails, und Interesse-Bekundung für Auswärtskarten unabhängig vom Freigabe-Mechanismus)
Supabase Self-Hosting via Docker auf eigener NAS (Zukunftsoption gegen Free-Tier-Limits)
Teststrategie – noch offen, wie ihr grundsätzlich testen wollt
Leaflet.js konkreter Einsatzzweck – noch nicht festgelegt, wofür genau
In-App-Benachrichtigungen – Realtime vs. Polling, technische Umsetzung offen