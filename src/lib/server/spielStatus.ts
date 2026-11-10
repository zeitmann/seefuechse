// src/lib/server/spielStatus.ts
//
// Eine Stelle für die Regel "Ist ein Spiel noch offen?". Offen = datum >= heute
// (Europe/Berlin) UND noch kein Endergebnis (tore_heimteam IS NULL). Sonst ist
// es gesperrt: Freigeben, Interesse anmelden, Bewerben und Vergeben werden
// abgelehnt; Zurückziehen bleibt immer erlaubt (Aufräumen alter Einträge).
//
// Ein Spiel von heute bleibt bis zum Endergebnis offen – wie der Tab "Kommende".

import { error } from '@sveltejs/kit';
import { and, eq, exists, gte, isNull, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { spiele } from '$lib/server/db/schema';
import { heuteDatum } from '$lib/spielAnzeige';

/** Einheitliche Meldung für alle gesperrten Aktionen. */
export const SPIEL_GESPERRT_MELDUNG = 'Dieses Spiel hat bereits stattgefunden.';

/** Regel für ein bereits geladenes Spiel (z. B. im load()). */
export function istSpielOffen(
	spiel: { datum: string; toreHeimteam: number | null },
	heute: string = heuteDatum()
): boolean {
	return spiel.datum >= heute && spiel.toreHeimteam === null;
}

/**
 * Dieselbe Regel als SQL-Bedingung zum Einbauen in bedingte Statements:
 * `EXISTS (select 1 from spiele where id = <spielId> and datum >= heute and
 * tore_heimteam is null)`. `spielId` ist eine Spalte (z. B. freigaben.spielId)
 * oder ein Wert. So läuft die Prüfung atomar im selben Statement wie das
 * Schreiben.
 */
export function spielOffenBedingung(spielId: AnyPgColumn | string): SQL {
	return exists(
		db
			.select({ eins: sql`1` })
			.from(spiele)
			.where(
				and(
					eq(spiele.id, spielId as string),
					gte(spiele.datum, heuteDatum()),
					isNull(spiele.toreHeimteam)
				)
			)
	);
}

/**
 * Wirft den passenden Fehler, nachdem ein bedingtes Statement wegen
 * spielOffenBedingung keine Zeile getroffen hat: 404, wenn es das Spiel nicht
 * gibt, sonst 409 mit SPIEL_GESPERRT_MELDUNG. Liefert nur zurück (ohne Fehler),
 * wenn das Spiel inzwischen doch offen ist – dann lag es nicht an der Sperre.
 */
export async function wennGesperrtFehler(spielId: string): Promise<void> {
	const spiel = await db.query.spiele.findFirst({
		columns: { datum: true, toreHeimteam: true },
		where: eq(spiele.id, spielId)
	});
	if (!spiel) error(404, 'Spiel nicht gefunden');
	if (!istSpielOffen(spiel)) error(409, SPIEL_GESPERRT_MELDUNG);
}

/** Lesezugriff, den sowohl `db` als auch eine Transaktion bietet. */
type Ausfuehrer = Pick<typeof db, 'select'>;

/**
 * Vorabprüfung innerhalb einer Transaktion: sperrt die Spielzeile (FOR SHARE),
 * damit z. B. der Sync bis zum Commit kein Ergebnis eintragen kann, und wirft
 * 404/409, wenn das Spiel fehlt oder gesperrt ist. Für Abläufe mit mehreren
 * Schreibschritten, bei denen eine einzelne WHERE-Bedingung nicht reicht.
 */
export async function spielOffenSperren(exec: Ausfuehrer, spielId: string): Promise<void> {
	const [spiel] = await exec
		.select({ datum: spiele.datum, toreHeimteam: spiele.toreHeimteam })
		.from(spiele)
		.where(eq(spiele.id, spielId))
		.for('share');
	if (!spiel) error(404, 'Spiel nicht gefunden');
	if (!istSpielOffen(spiel)) error(409, SPIEL_GESPERRT_MELDUNG);
}
