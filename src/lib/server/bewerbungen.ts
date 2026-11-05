import { db } from '$lib/server/db';
import { bewerbungen } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Zieht die eigene, noch nicht bearbeitete Bewerbung eines Mitglieds für eine
 * Freigabe zurück.
 *
 * Die WHERE-Bedingung (freigabe_id + mitglied_id + status='angefragt') trifft
 * höchstens eine Zeile – kein Read-then-Write, ein paralleles DELETE ist ein
 * harmloser No-Op.
 *
 * Wird von /spielplan/[id] und /anfragen gemeinsam genutzt.
 */
export async function bewerbungZurueckziehen(userId: string, freigabeId: string): Promise<void> {
	await db
		.delete(bewerbungen)
		.where(
			and(
				eq(bewerbungen.freigabeId, freigabeId),
				eq(bewerbungen.mitgliedId, userId),
				eq(bewerbungen.status, 'angefragt')
			)
		);
}
