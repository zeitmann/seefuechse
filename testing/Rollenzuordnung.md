| # | Account-Typ | Name | E-Mail | Passwort | Rolle | Mitglied-Status | Hat Dauerkarte? | Testet |
|---|---|---|---|---|---|---|---|---|
| 1 | Admin | Timon | ssz.timwal@gmail.com | `timon123` | `admin` | `aktiv` | ja | Vollzugriff, "Rollen verwalten" |
| 2 | Vorstand | Chefe | timon@wallroth.org | `chefe123` | `vorstand` | `aktiv` | ja | Verwaltungs-Zugriff ohne Rollenverwaltung |
| 3 | Mitglied mit DK | Christian | timon_w@icloud.com | `christian123` | `mitglied` | `aktiv` | ja | Normale Sicht, Karte-Tab, Freigabe-Mechanismus |
| 4 | Mitglied ohne DK | Severin | sorrychef@milchbuebi.com | `severin123` | `mitglied` | `aktiv` | nein | Zweite Navbar-Variante, Anfragen-Tab |


| Rolle | Verfügbare Seiten |
|---|---|
| Admin | Start, Spielplan, Anfragen, Karte, Verwaltung, verwaltung/rollen | 
| Vorstand | Start, Spielplan, Anfragen, Karte, Verwaltung | 
| Mitglieder mit DK | Start, Spielplan, Anfragen, Karte | 
| Mitglieder ohne DK | Start, Spielplan, Anfragen,  | 




to do next:

Punkt 2: Meine Einschätzung + was es dafür braucht

Gute Nachricht zuerst: einiges davon ist schon da oder deutlich einfacher als gedacht.

a) Deine eigene DK als Admin verwalten – Kein Code nötig. DK-Besitz wird ja laut eurem Architekturprinzip zur Laufzeit aus dauerkarten.besitzerId abgeleitet, nicht aus der Rolle. Sobald du (Timon) bei der echten Mitglieder-/Karten-Migration eine dauerkarten-Zeile mit besitzerId = deine mitglied-id bekommst, siehst du auf /karte automatisch deine eigene Karte, genau wie jedes andere Mitglied mit DK. Reine Datenfrage, kein Feature.

b) DK-Benennung + Nachvollziehbarkeit, wer eine Karte bekommen hat – Auch größtenteils schon da. dauerkarten.bezeichnung existiert bereits (aktuell "DK Chefe", "DK Christian" etc.) und jede freigaben-Zeile ist bereits ein historischer Datensatz pro Spiel mit vergebenAn – die Historie "welche Karte ging an wen für welches Spiel" ist also strukturell schon vollständig erfasst, ganz ohne Schema-Änderung. Was fehlt, ist nur eine Auswertungs-Seite/Statistik-View, die diese Daten aggregiert und anzeigt (z.B. "Holgers Karte ging dieses Jahr 5x an Tim, 2x an Stefan..."). Das ist reine Anzeige-Arbeit, kein DB-Umbau.

c) Sichtbarkeit, dass eine Karte frei ist – Größtenteils schon umgesetzt: das Start-Dashboard zeigt unter "Aktuell freie Karten" bereits Besitzername, Gegner, Datum und Bewerbungsstatus. Was noch fehlt: ob das auch auf der Spielplan-Detailseite (/spielplan/[id]) direkt beim jeweiligen Spiel sichtbar ist, inklusive Besitzername, damit man dort weiß, wen man kontaktieren muss. Müsste ich im Code noch prüfen, ob das schon existiert oder ergänzt werden muss.

d) Sichtbarkeit der Bewerber – Aktuell nur für den DK-Besitzer selbst sichtbar (auf /karte). Falls du willst, dass auch andere sehen, wie viele sich schon beworben haben (nicht zwingend wer), ist das mit dem bestehenden applicationCount-Feld im Free-Cards-Bereich eigentlich schon teilweise gelöst – nur die Namen der Bewerber selbst sind aktuell nicht öffentlich, nur die Anzahl.

e) Generelles Interesse an einer Karte pro Spiel anmelden, unabhängig von einer aktiven Freigabe – Das ist der aufwändigste Teil und tatsächlich ein neues Feature, kein bestehender Mechanismus. Aktuell hängt eine bewerbung immer an einer existierenden freigabe – dein Wunsch ist aber, dass jemand schon bevor eine Karte freigegeben wurde, Interesse an einem bestimmten Spiel hinterlegen kann (quasi eine Warteliste). Das braucht:

Neue DB-Tabelle (z.B. interesse: id, mitglied_id, spiel_id, erstellt_am) – unabhängig von freigaben/bewerbungen
Neue UI auf /spielplan/[id]: Button "Interesse anmelden", sichtbar für alle Mitglieder (auch DK-Besitzer, siehe deine Tabelle oben)
Verknüpfungslogik: wenn ein DK-Besitzer später eine Karte für genau dieses Spiel freigibt, sollte er idealerweise sehen "3 Mitglieder haben schon Interesse angemeldet" – das braucht eine Abfrage, die interesse mit freigaben über spiel_id verknüpft
Perspektivisch verwandt mit eurer bereits angedachten Auswärtsspiel-Vorverkauf-Idee auf der Backlog-Liste – beide drehen sich um "Interesse vor tatsächlicher Verfügbarkeit anmelden", könnte man later zusammen denken

Kurz zusammengefasst, was Punkt 2 an echter Neu-Entwicklung braucht: vor allem Punkt (e) – eine neue Tabelle plus UI plus Verknüpfungslogik. Die Punkte (a)–(d) sind größtenteils "schon vorhanden, nur noch nicht überall sichtbar gemacht" bzw. reine Datenpflege.