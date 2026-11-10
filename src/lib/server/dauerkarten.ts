import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { dauerkarten } from '$lib/server/db/schema';

export type DauerkartenEintrag = {
	id: string;
	bezeichnung: string;
	platz: string | null;
	besitzer: { name: string; status: 'ausstehend' | 'aktiv' | 'abgelehnt' };
};

/**
 * Alle Dauerkarten mit Besitzer für die Verwaltung, sortiert nach Besitzername
 * (bei gleichem Namen nach Bezeichnung). Sortiert wird in JS, weil die
 * Relational Query nicht nach einer Spalte der Relation ordnen kann.
 */
export async function dauerkartenUebersicht(): Promise<DauerkartenEintrag[]> {
	const karten = await db.query.dauerkarten.findMany({
		columns: { id: true, bezeichnung: true, platz: true },
		with: { besitzer: { columns: { name: true, status: true } } }
	});

	return karten.sort(
		(a, b) =>
			a.besitzer.name.localeCompare(b.besitzer.name, 'de') ||
			a.bezeichnung.localeCompare(b.bezeichnung, 'de')
	);
}

/**
 * Entfernt eine Dauerkarte. Zugehörige Freigaben und deren Bewerbungen werden
 * per ON DELETE CASCADE mitgelöscht.
 *
 * @returns true, wenn eine Karte gelöscht wurde; false, wenn sie nicht (mehr)
 *          existierte – das ist kein Fehler.
 */
export async function dauerkarteEntfernen(dauerkarteId: string): Promise<boolean> {
	const geloescht = await db
		.delete(dauerkarten)
		.where(eq(dauerkarten.id, dauerkarteId))
		.returning({ id: dauerkarten.id });
	return geloescht.length > 0;
}
