// src/lib/server/spielplanSync.ts
//
// Übernimmt den Spielplan des SC Freiburg aus OpenLigaDB in die Tabelle `spiele`.
// Phase 1: manuell per Button in /verwaltung ausgelöst (kein Cron).

import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spiele, syncLaeufe } from '$lib/server/db/schema';
import type { HeimAuswaerts, Wettbewerb } from '$lib/server/spiele';
import { leerzeichenBereinigen } from '$lib/server/vereinsnamen';

const API_BASIS = 'https://api.openligadb.de/getmatchdata';

/**
 * Saison für Button und Cron (2026 = Saison 2026/27) – die einzige Stelle.
 * Achtung: Einige Liga-Kürzel sind saisonabhängig (z. B. 'uecl2026'). Beim
 * Saisonwechsel beides anpassen und die Kürzel in LIGEN gegen OpenLigaDB prüfen.
 */
export const AKTUELLE_SAISON = 2026;

/** Protokollzeilen älter als diese Anzahl Tage werden nach jedem Lauf gelöscht. */
const PROTOKOLL_AUFBEWAHRUNG_TAGE = 90;

/** Teamname des SC Freiburg in OpenLigaDB (in allen Wettbewerben identisch). */
const EIGENES_TEAM = 'SC Freiburg';

/** Zeitlimit je Abruf – Netlify-Functions haben insgesamt nur ca. 10 s. */
const ABRUF_TIMEOUT_MS = 8000;

/**
 * Liga-Kürzel in OpenLigaDB → Wettbewerbsname in der App. `{saison}` wird
 * ersetzt (die Conference League hat ein saisonabhängiges Kürzel).
 */
const LIGEN: { kuerzel: string; wettbewerb: Wettbewerb }[] = [
	{ kuerzel: 'bl1', wettbewerb: 'Bundesliga' },
	{ kuerzel: 'dfb', wettbewerb: 'DFB-Pokal' },
	{ kuerzel: 'uecl{saison}', wettbewerb: 'Conference League' }
];

/** Der für uns relevante Ausschnitt eines Spiels aus getmatchdata. */
type OpenLigaSpiel = {
	matchID: number;
	matchDateTime: string;
	lastUpdateDateTime: string | null;
	team1: { teamName: string };
	team2: { teamName: string };
};

type SpielZeile = {
	openligadbId: string;
	datum: string;
	uhrzeit: string;
	gegner: string;
	wettbewerb: Wettbewerb;
	heimAuswaerts: HeimAuswaerts;
	aktualisiertAm: string | null;
};

export type TerminAenderung = {
	spielId: string;
	alt: { datum: string; uhrzeit: string | null };
	neu: { datum: string; uhrzeit: string | null };
};

export type SyncErgebnis = {
	neu: number;
	geaendert: number;
	unveraendert: number;
	uebersprungenManuell: number;
	hinweise: string[];
	/** Anzahl Ligen, deren Abruf fehlschlug (HTTP-, Netzwerk- oder Formatfehler). */
	abrufFehler: number;
	/** Spiele mit verschobenem Datum/Anpfiff – Grundlage für spätere Benachrichtigungen. */
	terminAenderungen: TerminAenderung[];
};

// 'JJJJ-MM-TTTHH:MM:SS' – bereits deutsche Ortszeit, daher reiner String-Split.
const ZEITPUNKT_MUSTER = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/;

function istOpenLigaSpiel(wert: unknown): wert is OpenLigaSpiel {
	const s = wert as OpenLigaSpiel;
	return (
		typeof s === 'object' &&
		s !== null &&
		typeof s.matchID === 'number' &&
		typeof s.matchDateTime === 'string' &&
		typeof s.team1?.teamName === 'string' &&
		typeof s.team2?.teamName === 'string'
	);
}

/** Wandelt ein API-Spiel in eine Zeile um; null, wenn Freiburg nicht beteiligt ist. */
function alsSpielZeile(spiel: OpenLigaSpiel, wettbewerb: Wettbewerb): SpielZeile | null {
	const istHeim = spiel.team1.teamName === EIGENES_TEAM;
	if (!istHeim && spiel.team2.teamName !== EIGENES_TEAM) return null;

	const zeitpunkt = ZEITPUNKT_MUSTER.exec(spiel.matchDateTime);
	if (!zeitpunkt) return null;

	return {
		openligadbId: String(spiel.matchID),
		datum: zeitpunkt[1],
		uhrzeit: zeitpunkt[2],
		gegner: leerzeichenBereinigen(istHeim ? spiel.team2.teamName : spiel.team1.teamName),
		wettbewerb,
		heimAuswaerts: istHeim ? 'heim' : 'auswaerts',
		aktualisiertAm: spiel.lastUpdateDateTime || null
	};
}

/**
 * Lädt die Freiburg-Spiele einer Liga. Fehler werden als Hinweis gemeldet, nicht
 * geworfen; Rückgabe null = Abruf fehlgeschlagen ([] = erfolgreich, aber leer).
 */
async function ligaAbrufen(
	kuerzel: string,
	wettbewerb: Wettbewerb,
	saison: number,
	hinweise: string[]
): Promise<SpielZeile[] | null> {
	const url = `${API_BASIS}/${kuerzel}/${saison}`;
	let daten: unknown;
	try {
		const antwort = await fetch(url, { signal: AbortSignal.timeout(ABRUF_TIMEOUT_MS) });
		if (!antwort.ok) {
			hinweise.push(`${wettbewerb}: Abruf fehlgeschlagen (HTTP ${antwort.status}).`);
			return null;
		}
		daten = await antwort.json();
	} catch (e) {
		const grund =
			e instanceof Error && e.name === 'TimeoutError' ? 'Zeitüberschreitung' : 'Netzwerkfehler';
		hinweise.push(`${wettbewerb}: Abruf fehlgeschlagen (${grund}).`);
		return null;
	}

	if (!Array.isArray(daten)) {
		hinweise.push(`${wettbewerb}: Unerwartetes Antwortformat von OpenLigaDB.`);
		return null;
	}

	const zeilen: SpielZeile[] = [];
	let unlesbar = 0;
	for (const eintrag of daten) {
		if (!istOpenLigaSpiel(eintrag)) {
			unlesbar++;
			continue;
		}
		const zeile = alsSpielZeile(eintrag, wettbewerb);
		if (zeile) zeilen.push(zeile);
	}

	if (unlesbar > 0) {
		hinweise.push(`${wettbewerb}: ${unlesbar} Einträge mit unerwartetem Format übersprungen.`);
	}
	if (zeilen.length === 0) {
		hinweise.push(`${wettbewerb}: Keine Spiele des ${EIGENES_TEAM} gefunden (Saison ${saison}).`);
	}
	return zeilen;
}

/**
 * Synchronisiert den Spielplan der Saison (z. B. 2026 für 2026/27).
 *
 * Schreibweg: EIN `insert … on conflict (openligadb_id) do update … where …`.
 * Ob ein bestehendes Spiel überschrieben wird, entscheidet allein die Datenbank
 * über die WHERE-Klausel (nicht manuell überschrieben UND fachliche Felder
 * verschieden) – kein Read-then-Write. Die vorgelagerte Leseabfrage dient nur
 * dazu, das Ergebnis zu beschriften (neu/geändert/…) und alte Termine für die
 * Liste der Terminänderungen zu kennen.
 *
 * Spiele, die in der API fehlen, werden nicht gelöscht.
 */
export async function synchronisiereSpielplan(saison: number): Promise<SyncErgebnis> {
	const hinweise: string[] = [];

	const jeLiga = await Promise.all(
		LIGEN.map(({ kuerzel, wettbewerb }) =>
			ligaAbrufen(kuerzel.replace('{saison}', String(saison)), wettbewerb, saison, hinweise)
		)
	);

	// Doppelte matchIDs entfernen – sonst bricht ON CONFLICT mit "cannot affect
	// row a second time" ab.
	const zeilen = [
		...new Map(jeLiga.flatMap((liga) => liga ?? []).map((z) => [z.openligadbId, z])).values()
	];

	const ergebnis: SyncErgebnis = {
		neu: 0,
		geaendert: 0,
		unveraendert: 0,
		uebersprungenManuell: 0,
		hinweise,
		abrufFehler: jeLiga.filter((liga) => liga === null).length,
		terminAenderungen: []
	};
	if (zeilen.length === 0) return ergebnis;

	const ids = zeilen.map((z) => z.openligadbId);

	// Nur zur Beschriftung des Ergebnisses (siehe Funktionskommentar).
	const vorher = await db
		.select({
			id: spiele.id,
			openligadbId: spiele.openligadbId,
			datum: spiele.datum,
			uhrzeit: spiele.uhrzeit,
			manuellUeberschrieben: spiele.manuellUeberschrieben
		})
		.from(spiele)
		.where(inArray(spiele.openligadbId, ids));
	const vorherNachId = new Map(vorher.map((v) => [v.openligadbId, v]));

	const geschrieben = await db
		.insert(spiele)
		.values(
			zeilen.map((z) => ({
				openligadbId: z.openligadbId,
				datum: z.datum,
				uhrzeit: z.uhrzeit,
				gegner: z.gegner,
				wettbewerb: z.wettbewerb,
				heimAuswaerts: z.heimAuswaerts,
				// OpenLigaDB liefert den Zeitstempel ohne Zone in deutscher Ortszeit.
				openligadbAktualisiertAm: z.aktualisiertAm
					? sql`(${z.aktualisiertAm}::timestamp at time zone 'Europe/Berlin')`
					: null
			}))
		)
		.onConflictDoUpdate({
			target: spiele.openligadbId,
			set: {
				datum: sql`excluded.datum`,
				uhrzeit: sql`excluded.uhrzeit`,
				gegner: sql`excluded.gegner`,
				wettbewerb: sql`excluded.wettbewerb`,
				heimAuswaerts: sql`excluded.heim_auswaerts`,
				openligadbAktualisiertAm: sql`excluded.openligadb_aktualisiert_am`
			},
			setWhere: and(
				eq(spiele.manuellUeberschrieben, false),
				sql`(${spiele.datum}, ${spiele.uhrzeit}, ${spiele.gegner}, ${spiele.wettbewerb}, ${spiele.heimAuswaerts})
					is distinct from
					(excluded.datum, excluded.uhrzeit, excluded.gegner, excluded.wettbewerb, excluded.heim_auswaerts)`
			)
		})
		.returning({ id: spiele.id, openligadbId: spiele.openligadbId });

	// Zurückgegeben werden nur tatsächlich eingefügte oder geänderte Zeilen.
	const geschriebenIds = new Set(geschrieben.map((g) => g.openligadbId));
	const neuNachId = new Map(zeilen.map((z) => [z.openligadbId, z]));

	for (const g of geschrieben) {
		const alt = vorherNachId.get(g.openligadbId);
		const neu = neuNachId.get(g.openligadbId ?? '');
		if (!alt || !neu) {
			ergebnis.neu++;
			continue;
		}
		ergebnis.geaendert++;
		if (alt.datum !== neu.datum || alt.uhrzeit !== neu.uhrzeit) {
			ergebnis.terminAenderungen.push({
				spielId: g.id,
				alt: { datum: alt.datum, uhrzeit: alt.uhrzeit },
				neu: { datum: neu.datum, uhrzeit: neu.uhrzeit }
			});
		}
	}

	for (const z of zeilen) {
		if (geschriebenIds.has(z.openligadbId)) continue;
		if (vorherNachId.get(z.openligadbId)?.manuellUeberschrieben) ergebnis.uebersprungenManuell++;
		else ergebnis.unveraendert++;
	}

	return ergebnis;
}

export type SyncQuelle = 'cron' | 'manuell';

export type ProtokollierterSync = SyncErgebnis & { erfolgreich: boolean };

function fehlerText(e: unknown): string {
	return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}

/**
 * Führt den Sync für AKTUELLE_SAISON aus, schreibt eine Zeile in sync_laeufe
 * und löscht Protokolle älter als 90 Tage. Wirft nie: auch bei Ausnahmen wird
 * (wenn möglich) ein Protokoll mit erfolgreich = false geschrieben und ein
 * Ergebnis zurückgegeben.
 *
 * Fehlgeschlagen = Abruffehler einer Liga oder Datenbankfehler. Eine Liga ohne
 * Freiburg-Spiele ist nur ein Hinweis.
 */
export async function fuehreSyncMitProtokollAus(quelle: SyncQuelle): Promise<ProtokollierterSync> {
	let ergebnis: ProtokollierterSync;
	try {
		const sync = await synchronisiereSpielplan(AKTUELLE_SAISON);
		ergebnis = { ...sync, erfolgreich: sync.abrufFehler === 0 };
	} catch (e) {
		console.error('Spielplan-Sync abgebrochen:', e);
		ergebnis = {
			neu: 0,
			geaendert: 0,
			unveraendert: 0,
			uebersprungenManuell: 0,
			hinweise: [`Sync abgebrochen: ${fehlerText(e)}`],
			abrufFehler: 0,
			terminAenderungen: [],
			erfolgreich: false
		};
	}

	try {
		await db.insert(syncLaeufe).values({
			quelle,
			saison: AKTUELLE_SAISON,
			erfolgreich: ergebnis.erfolgreich,
			neu: ergebnis.neu,
			geaendert: ergebnis.geaendert,
			unveraendert: ergebnis.unveraendert,
			uebersprungen: ergebnis.uebersprungenManuell,
			hinweise: ergebnis.hinweise.length > 0 ? ergebnis.hinweise.join('\n') : null
		});
		await db
			.delete(syncLaeufe)
			.where(
				lt(
					syncLaeufe.gestartetAm,
					sql`now() - make_interval(days => ${PROTOKOLL_AUFBEWAHRUNG_TAGE})`
				)
			);
	} catch (e) {
		console.error('Sync-Protokoll konnte nicht geschrieben werden:', e);
		ergebnis.hinweise.push(`Protokoll konnte nicht gespeichert werden: ${fehlerText(e)}`);
		ergebnis.erfolgreich = false;
	}

	return ergebnis;
}
