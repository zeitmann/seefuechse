// src/lib/server/benachrichtigungen.ts
//
// Kernfunktionen für In-App-Benachrichtigungen. Der Push-Versand wird in einem
// späteren Schritt in benachrichtigen() angehängt.

import { and, count, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
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

/**
 * Wie benachrichtigen(), wirft aber nie: Fehler werden nur geloggt. Gedacht für
 * Aufrufe NACH Abschluss der eigentlichen DB-Transaktion, damit eine fehlgeschlagene
 * Benachrichtigung die bereits gespeicherte Aktion nicht als Fehler erscheinen lässt.
 *
 * Statt fertiger Daten kann auch eine Funktion übergeben werden, die die Daten erst
 * lädt (z. B. Namen, Spieldaten). Dann sind auch Fehler beim Laden abgefangen;
 * liefert sie null, wird nicht benachrichtigt.
 */
export async function benachrichtigenOhneFehler(
	daten: BenachrichtigenDaten | (() => Promise<BenachrichtigenDaten | null>)
): Promise<void> {
	try {
		const aufgeloest = typeof daten === 'function' ? await daten() : daten;
		if (aufgeloest) await benachrichtigen(aufgeloest);
	} catch (e) {
		console.error('Benachrichtigung fehlgeschlagen:', e);
	}
}

/** Anzeigename eines Spiels aus Sicht des SC Freiburg, z. B. 'SC Freiburg – FC Bayern'. */
export function spielBezeichnung(spiel: {
	gegner: string;
	heimAuswaerts: 'heim' | 'auswaerts';
}): string {
	return spiel.heimAuswaerts === 'heim'
		? `SC Freiburg – ${spiel.gegner}`
		: `${spiel.gegner} – SC Freiburg`;
}

/** Link-Ziel aller Benachrichtigungen zu einem Spiel. */
export function spielLink(spielId: string): string {
	return `/spielplan/${spielId}`;
}

/**
 * Gibt es innerhalb der letzten `minuten` bereits irgendeine Benachrichtigung mit
 * genau diesem typ, link und text (egal für welchen Empfänger)? Spam-Schutz.
 */
export async function kuerzlichBenachrichtigt(
	{ typ, link, text }: Pick<BenachrichtigenDaten, 'typ' | 'link' | 'text'>,
	minuten: number
): Promise<boolean> {
	const [treffer] = await db
		.select({ id: benachrichtigungen.id })
		.from(benachrichtigungen)
		.where(
			and(
				eq(benachrichtigungen.typ, typ),
				eq(benachrichtigungen.link, link),
				eq(benachrichtigungen.text, text),
				gt(benachrichtigungen.erstelltAm, sql`now() - make_interval(mins => ${minuten}::int)`)
			)
		)
		.limit(1);
	return treffer != null;
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
