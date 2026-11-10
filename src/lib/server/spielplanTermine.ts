// src/lib/server/spielplanTermine.ts
//
// Leitet zur Laufzeit ab, ob die Anstoßzeit eines Bundesliga-Spiels schon von
// der DFL festgelegt wurde. Keine eigene Spalte: Grundlage sind die
// OpenLigaDB-Zeitstempel aus dem Spielplan-Sync.

import { and, eq, max, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spiele } from '$lib/server/db/schema';

/**
 * Spätestes Datum eines Bundesliga-Spiels, das nach dem Erstimport noch einmal
 * in OpenLigaDB aktualisiert wurde – bis dahin gelten die Anstoßzeiten als von
 * der DFL angesetzt. null, wenn es (noch) kein solches Spiel gibt.
 *
 * Hintergrund: Der Erstimport trägt bei allen Spielen nahezu denselben
 * Zeitstempel (Spanne unter einem Tag). Spiele, die die DFL später zeitgenau
 * terminiert, bekommen einen deutlich jüngeren Zeitstempel.
 */
export async function ermittleTerminierungsStichtag(): Promise<string | null> {
	const erstimport = db
		.select({ zeitpunkt: sql`min(${spiele.openligadbAktualisiertAm})` })
		.from(spiele)
		.where(eq(spiele.wettbewerb, 'Bundesliga'));

	const [zeile] = await db
		.select({ stichtag: max(spiele.datum) })
		.from(spiele)
		.where(
			and(
				eq(spiele.wettbewerb, 'Bundesliga'),
				sql`${spiele.openligadbAktualisiertAm} > (${erstimport}) + interval '1 day'`
			)
		);

	return zeile?.stichtag ?? null;
}

type SpielFuerTermin = {
	datum: string;
	wettbewerb: string;
	openligadbId: string | null;
	manuellUeberschrieben: boolean;
};

/**
 * true, wenn die Anstoßzeit eines kommenden, synchronisierten und nicht von Hand
 * gepflegten Bundesliga-Spiels noch nicht bestätigt ist (nach dem Stichtag oder
 * gar kein Stichtag bekannt).
 */
export function istUhrzeitVorlaeufig(
	spiel: SpielFuerTermin,
	stichtag: string | null,
	heute: string = new Date().toISOString().slice(0, 10)
): boolean {
	return (
		spiel.wettbewerb === 'Bundesliga' &&
		spiel.openligadbId !== null &&
		!spiel.manuellUeberschrieben &&
		spiel.datum >= heute &&
		(stichtag === null || spiel.datum > stichtag)
	);
}

/** Hängt `uhrzeitVorlaeufig` an jedes Spiel (Stichtag einmal pro Request ermitteln). */
export function mitUhrzeitVorlaeufig<T extends SpielFuerTermin>(
	liste: T[],
	stichtag: string | null
): (T & { uhrzeitVorlaeufig: boolean })[] {
	const heute = new Date().toISOString().slice(0, 10);
	return liste.map((spiel) => ({
		...spiel,
		uhrzeitVorlaeufig: istUhrzeitVorlaeufig(spiel, stichtag, heute)
	}));
}
