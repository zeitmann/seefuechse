import { db } from '$lib/server/db';
import { interesse } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { istUniqueViolation } from '$lib/server/db/errors';
import { hatAktiveEigeneFreigabe } from '$lib/server/freigaben';

/**
 * Meldet Interesse eines Mitglieds für ein Spiel an bzw. zieht es zurück.
 *
 * Existiert bereits ein Eintrag für (mitglied_id, spiel_id) → DELETE, sonst
 * INSERT. Ein INSERT wird abgelehnt (409), wenn der Nutzer für dieses Spiel
 * selbst eine Freigabe mit Status offen/vergeben hat; das Zurückziehen (DELETE)
 * bleibt immer erlaubt. Der Unique Constraint auf (mitglied_id, spiel_id) fängt einen zweiten
 * INSERT durch Doppelklick/Race Condition als No-Op ab.
 *
 * Wird von /spielplan/[id] (toggleInteresse) und /anfragen
 * (interesseZurueckziehen) gemeinsam genutzt.
 */
export async function toggleInteresse(userId: string, spielId: string): Promise<void> {
	const vorhanden = await db.query.interesse.findFirst({
		where: and(eq(interesse.mitgliedId, userId), eq(interesse.spielId, spielId))
	});

	if (vorhanden) {
		// WHERE (mitglied_id, spiel_id) trifft höchstens eine Zeile – ein
		// paralleles DELETE ist damit ein harmloser No-Op.
		await db
			.delete(interesse)
			.where(and(eq(interesse.mitgliedId, userId), eq(interesse.spielId, spielId)));
	} else {
		if (await hatAktiveEigeneFreigabe(userId, spielId)) {
			error(409, 'Für ein Spiel mit eigener Freigabe kann kein Interesse angemeldet werden.');
		}
		try {
			await db.insert(interesse).values({ mitgliedId: userId, spielId });
		} catch (e) {
			if (!istUniqueViolation(e)) throw e;
		}
	}
}
