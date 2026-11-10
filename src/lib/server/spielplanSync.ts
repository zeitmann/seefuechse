// src/lib/server/spielplanSync.ts
//
// Übernimmt den Spielplan des SC Freiburg aus OpenLigaDB in die Tabelle `spiele`.
// Ausgelöst täglich per Netlify Scheduled Function (über /api/cron/spielplan-sync)
// und manuell per Button in /verwaltung; jeder Lauf wird in sync_laeufe protokolliert.

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

/**
 * Zeitlimit je Liga-Abruf: 8 s. Die Abrufe laufen parallel. Die Scheduled
 * Function, die den Cron-Endpoint aufruft, darf max. 30 s laufen und wartet
 * selbst höchstens 25 s auf die Antwort.
 */
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

/** resultTypeID des Endergebnisses in matchResults (1 = Halbzeit). */
const ERGEBNISTYP_ENDERGEBNIS = 2;

/**
 * Der für uns relevante Ausschnitt eines Spiels aus getmatchdata. group,
 * matchIsFinished und matchResults sind optional und werden nur weich geprüft:
 * fehlen sie oder passen sie nicht, bleiben Runde bzw. Ergebnis null – das
 * Spiel selbst wird trotzdem übernommen.
 */
type OpenLigaSpiel = {
	matchID: number;
	matchDateTime: string;
	lastUpdateDateTime: string | null;
	team1: { teamName: string };
	team2: { teamName: string };
	group?: { groupName?: string };
	matchIsFinished?: boolean;
	matchResults?: Array<{ resultTypeID: number; pointsTeam1: number; pointsTeam2: number }>;
};

type SpielZeile = {
	openligadbId: string;
	datum: string;
	uhrzeit: string;
	gegner: string;
	wettbewerb: Wettbewerb;
	heimAuswaerts: HeimAuswaerts;
	aktualisiertAm: string | null;
	runde: string | null;
	/** Tore team1 (Heimteam im Stadion), null = kein Endergebnis */
	toreHeimteam: number | null;
	/** Tore team2 (Gastteam im Stadion), null = kein Endergebnis */
	toreGastteam: number | null;
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
	/**
	 * Bestehende Spiele, bei denen sich Runde oder Endergebnis geändert hat
	 * (unabhängig von neu/geaendert/unveraendert, die nur die Terminfelder betreffen).
	 */
	ergebnisseAktualisiert: number;
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
		// group, matchIsFinished und matchResults bewusst NICHT prüfen: Sie sind
		// optional und werden in rundeLesen/ergebnisLesen weich ausgewertet.
	);
}

/** group.groupName getrimmt; null, wenn fehlend, leer oder kein String. */
function rundeLesen(spiel: OpenLigaSpiel): string | null {
	const name: unknown = spiel.group?.groupName;
	if (typeof name !== 'string') return null;
	return leerzeichenBereinigen(name) || null;
}

function istToranzahl(wert: unknown): wert is number {
	return typeof wert === 'number' && Number.isInteger(wert) && wert >= 0;
}

/**
 * Endergebnis in Stadion-Reihenfolge (team1 = Heimteam). Nur bei
 * matchIsFinished === true und vorhandenem Endergebnis-Eintrag, sonst beide null.
 */
function ergebnisLesen(spiel: OpenLigaSpiel): { heim: number; gast: number } | null {
	if (spiel.matchIsFinished !== true || !Array.isArray(spiel.matchResults)) return null;
	const ende: unknown = spiel.matchResults.find(
		(r: unknown) =>
			typeof r === 'object' &&
			r !== null &&
			(r as { resultTypeID?: unknown }).resultTypeID === ERGEBNISTYP_ENDERGEBNIS
	);
	if (!ende) return null;
	const { pointsTeam1, pointsTeam2 } = ende as { pointsTeam1?: unknown; pointsTeam2?: unknown };
	if (!istToranzahl(pointsTeam1) || !istToranzahl(pointsTeam2)) return null;
	return { heim: pointsTeam1, gast: pointsTeam2 };
}

/** Wandelt ein API-Spiel in eine Zeile um; null, wenn Freiburg nicht beteiligt ist. */
function alsSpielZeile(spiel: OpenLigaSpiel, wettbewerb: Wettbewerb): SpielZeile | null {
	const istHeim = spiel.team1.teamName === EIGENES_TEAM;
	if (!istHeim && spiel.team2.teamName !== EIGENES_TEAM) return null;

	const zeitpunkt = ZEITPUNKT_MUSTER.exec(spiel.matchDateTime);
	if (!zeitpunkt) return null;

	const ergebnis = ergebnisLesen(spiel);

	return {
		openligadbId: String(spiel.matchID),
		datum: zeitpunkt[1],
		uhrzeit: zeitpunkt[2],
		gegner: leerzeichenBereinigen(istHeim ? spiel.team2.teamName : spiel.team1.teamName),
		wettbewerb,
		heimAuswaerts: istHeim ? 'heim' : 'auswaerts',
		aktualisiertAm: spiel.lastUpdateDateTime || null,
		runde: rundeLesen(spiel),
		toreHeimteam: ergebnis?.heim ?? null,
		toreGastteam: ergebnis?.gast ?? null
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
		terminAenderungen: [],
		ergebnisseAktualisiert: 0
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
				// Nur beim Insert wirksam; bestehende Spiele aktualisiert rundeUndErgebnisSchreiben.
				runde: z.runde,
				toreHeimteam: z.toreHeimteam,
				toreGastteam: z.toreGastteam,
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

	// Erst nach dem Upsert: Neu eingefügte Spiele haben Runde/Ergebnis dann schon
	// und werden hier nicht noch einmal gezählt.
	ergebnis.ergebnisseAktualisiert = await rundeUndErgebnisSchreiben(zeilen);

	return ergebnis;
}

/**
 * Aktualisiert Runde und Endergebnis bestehender synchronisierter Spiele – in
 * EINEM bedingten `update … from (values …)`. Anders als der Upsert bewusst
 * auch bei manuell_ueberschrieben = true: Für Runde und Ergebnis ist OpenLigaDB
 * die Quelle, das Flag schützt nur die Terminfelder. Geschrieben wird nur, wenn sich mindestens
 * ein Wert unterscheidet (IS DISTINCT FROM); openligadb_aktualisiert_am und
 * manuell_ueberschrieben bleiben unangetastet, damit die "vorläufig"-Heuristik
 * (spielplanTermine.ts) nicht verfälscht wird. Spiele ohne openligadb_id
 * (Testspiele) treffen die Join-Bedingung nie.
 *
 * Rückgabe: Anzahl tatsächlich geänderter Spiele.
 */
async function rundeUndErgebnisSchreiben(zeilen: SpielZeile[]): Promise<number> {
	if (zeilen.length === 0) return 0;

	const werte = sql.join(
		zeilen.map(
			(z) =>
				sql`(${z.openligadbId}::text, ${z.runde}::text, ${z.toreHeimteam}::integer, ${z.toreGastteam}::integer)`
		),
		sql`, `
	);

	// postgres-js liefert die returning-Zeilen als Array.
	const geaendert = await db.execute(sql`
		update ${spiele}
		set runde = neu.runde,
			tore_heimteam = neu.tore_heimteam,
			tore_gastteam = neu.tore_gastteam
		from (values ${werte}) as neu (openligadb_id, runde, tore_heimteam, tore_gastteam)
		where ${spiele.openligadbId} = neu.openligadb_id
			and (${spiele.runde}, ${spiele.toreHeimteam}, ${spiele.toreGastteam})
				is distinct from
				(neu.runde, neu.tore_heimteam, neu.tore_gastteam)
		returning ${spiele.id}
	`);
	return geaendert.length;
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
			ergebnisseAktualisiert: 0,
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
