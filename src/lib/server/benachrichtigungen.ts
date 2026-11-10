// src/lib/server/benachrichtigungen.ts
//
// Kernfunktionen für In-App-Benachrichtigungen. Der Push-Versand wird in einem
// späteren Schritt in benachrichtigen() angehängt.

import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { benachrichtigungen, mitglieder, type BenachrichtigungTyp } from '$lib/server/db/schema';

/** Drizzle-Transaktion, wie sie db.transaction() an den Callback übergibt. */
export type Transaktion = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Benachrichtigung = typeof benachrichtigungen.$inferSelect;

export interface BenachrichtigenDaten {
	empfaengerIds: string[];
	typ: BenachrichtigungTyp;
	titel: string;
	text: string;
	link: string;
	/** Wer die Aktion ausgelöst hat, wird nicht benachrichtigt. */
	ausloeserId?: string | null;
}

/**
 * Legt für jeden (aktiven) Empfänger eine Benachrichtigung an.
 * Mit tx läuft der Aufruf innerhalb einer bestehenden Transaktion mit.
 * Gibt die eingefügten Zeilen zurück.
 */
export async function benachrichtigen(
	{ empfaengerIds, typ, titel, text, link, ausloeserId }: BenachrichtigenDaten,
	tx?: Transaktion
): Promise<Benachrichtigung[]> {
	const q = tx ?? db;

	// Doppelte entfernen und den Auslöser selbst ausschließen
	const kandidaten = [...new Set(empfaengerIds)].filter((id) => id !== ausloeserId);
	if (kandidaten.length === 0) return [];

	// Nur aktive Mitglieder benachrichtigen
	const aktive = await q
		.select({ id: mitglieder.id })
		.from(mitglieder)
		.where(and(inArray(mitglieder.id, kandidaten), eq(mitglieder.status, 'aktiv')));
	if (aktive.length === 0) return [];

	// Ein einziger Bulk-INSERT für alle Empfänger
	const eingefuegt = await q
		.insert(benachrichtigungen)
		.values(aktive.map(({ id }) => ({ mitgliedId: id, typ, titel, text, link })))
		.returning();

	// TODO Schritt 4: Push-Versand für die eingefügten Zeilen anstoßen

	return eingefuegt;
}

/** Anzahl ungelesener Benachrichtigungen eines Mitglieds. */
export async function ungeleseneAnzahl(mitgliedId: string): Promise<number> {
	const [zeile] = await db
		.select({ anzahl: count() })
		.from(benachrichtigungen)
		.where(
			and(eq(benachrichtigungen.mitgliedId, mitgliedId), isNull(benachrichtigungen.gelesenAm))
		);
	return zeile?.anzahl ?? 0;
}

/** Benachrichtigungen eines Mitglieds, neueste zuerst. */
export async function benachrichtigungenListe(
	mitgliedId: string,
	limit = 50
): Promise<Benachrichtigung[]> {
	return db
		.select()
		.from(benachrichtigungen)
		.where(eq(benachrichtigungen.mitgliedId, mitgliedId))
		.orderBy(desc(benachrichtigungen.erstelltAm))
		.limit(limit);
}

/**
 * Markiert eine Benachrichtigung als gelesen. Die Autorisierung steckt in der
 * WHERE-Klausel: Fremde oder bereits gelesene Zeilen werden nicht verändert.
 * Gibt zurück, ob eine Zeile aktualisiert wurde.
 */
export async function alsGelesenMarkieren(mitgliedId: string, id: string): Promise<boolean> {
	const aktualisiert = await db
		.update(benachrichtigungen)
		.set({ gelesenAm: new Date() })
		.where(
			and(
				eq(benachrichtigungen.id, id),
				eq(benachrichtigungen.mitgliedId, mitgliedId),
				isNull(benachrichtigungen.gelesenAm)
			)
		)
		.returning({ id: benachrichtigungen.id });
	return aktualisiert.length > 0;
}

/** Markiert alle ungelesenen Benachrichtigungen eines Mitglieds als gelesen. */
export async function alleAlsGelesenMarkieren(mitgliedId: string): Promise<number> {
	const aktualisiert = await db
		.update(benachrichtigungen)
		.set({ gelesenAm: new Date() })
		.where(
			and(eq(benachrichtigungen.mitgliedId, mitgliedId), isNull(benachrichtigungen.gelesenAm))
		)
		.returning({ id: benachrichtigungen.id });
	return aktualisiert.length;
}
