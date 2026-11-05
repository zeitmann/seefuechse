import { db } from '$lib/server/db';
import { interesse } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { istUniqueViolation } from '$lib/server/db/errors';
import { hatAktiveEigeneFreigabe } from '$lib/server/freigaben';

/**
 * Meldet Interesse eines Mitglieds für ein Spiel an (nur INSERT).
 *
 * Abgelehnt (409), wenn der Nutzer für dieses Spiel selbst eine Freigabe mit
 * Status offen/vergeben hat. Der Unique Constraint auf (mitglied_id, spiel_id)
 * fängt einen zweiten INSERT durch Doppelklick/Race Condition als No-Op ab.
 *
 * Genutzt von /spielplan/[id] (interesseAnmelden).
 */
export async function interesseAnmelden(userId: string, spielId: string): Promise<void> {
	if (await hatAktiveEigeneFreigabe(userId, spielId)) {
		error(409, 'Für ein Spiel mit eigener Freigabe kann kein Interesse angemeldet werden.');
	}
	try {
		await db.insert(interesse).values({ mitgliedId: userId, spielId });
	} catch (e) {
		if (!istUniqueViolation(e)) throw e;
	}
}

/**
 * Zieht das Interesse eines Mitglieds für ein Spiel zurück (nur DELETE).
 *
 * WHERE (mitglied_id, spiel_id) trifft höchstens eine Zeile; existiert kein
 * Eintrag (z. B. schon durch eine Vergabe entfernt), ist es ein harmloser No-Op.
 * Immer erlaubt, auch bei eigener Freigabe.
 *
 * Genutzt von /spielplan/[id] und /anfragen (jeweils interesseZurueckziehen).
 */
export async function interesseZurueckziehen(userId: string, spielId: string): Promise<void> {
	await db
		.delete(interesse)
		.where(and(eq(interesse.mitgliedId, userId), eq(interesse.spielId, spielId)));
}
