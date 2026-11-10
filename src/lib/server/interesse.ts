import { db } from '$lib/server/db';
import { dauerkarten, freigaben, interesse, mitglieder, spiele } from '$lib/server/db/schema';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { istUniqueViolation } from '$lib/server/db/errors';
import { hatAktiveEigeneFreigabe } from '$lib/server/freigaben';
import {
	benachrichtigenOhneFehler,
	spielBezeichnung,
	spielLink
} from '$lib/server/benachrichtigungen';

/**
 * Meldet Interesse eines Mitglieds für ein Spiel an (nur INSERT).
 *
 * Abgelehnt (409), wenn der Nutzer für dieses Spiel selbst eine Freigabe mit
 * Status offen/vergeben hat. Der Unique Constraint auf (mitglied_id, spiel_id)
 * fängt einen zweiten INSERT durch Doppelklick/Race Condition als No-Op ab.
 *
 * Wurde wirklich ein Eintrag angelegt, werden alle Dauerkarten-Besitzer ohne
 * offene/vergebene Freigabe für dieses Spiel benachrichtigt.
 *
 * Genutzt von /spielplan/[id] (interesseAnmelden).
 */
export async function interesseAnmelden(userId: string, spielId: string): Promise<void> {
	if (await hatAktiveEigeneFreigabe(userId, spielId)) {
		error(409, 'Für ein Spiel mit eigener Freigabe kann kein Interesse angemeldet werden.');
	}
	let angelegt = false;
	try {
		const zeilen = await db
			.insert(interesse)
			.values({ mitgliedId: userId, spielId })
			.returning({ id: interesse.id });
		angelegt = zeilen.length > 0;
	} catch (e) {
		if (!istUniqueViolation(e)) throw e;
	}
	if (!angelegt) return;

	await benachrichtigenOhneFehler(async () => {
		// Besitzer, die für dieses Spiel schon eine offene/vergebene Freigabe haben
		// (Gegenstück zu hatAktiveEigeneFreigabe, für alle Besitzer auf einmal).
		const besitzerMitAktiverFreigabe = db
			.select({ id: dauerkarten.besitzerId })
			.from(freigaben)
			.innerJoin(dauerkarten, eq(freigaben.dauerkarteId, dauerkarten.id))
			.where(
				and(eq(freigaben.spielId, spielId), inArray(freigaben.status, ['offen', 'vergeben']))
			);

		const [empfaenger, mitglied, spiel] = await Promise.all([
			db
				.selectDistinct({ id: dauerkarten.besitzerId })
				.from(dauerkarten)
				.where(notInArray(dauerkarten.besitzerId, besitzerMitAktiverFreigabe)),
			db.query.mitglieder.findFirst({
				columns: { name: true },
				where: eq(mitglieder.id, userId)
			}),
			db.query.spiele.findFirst({
				columns: { gegner: true, heimAuswaerts: true },
				where: eq(spiele.id, spielId)
			})
		]);
		if (!mitglied || !spiel) return null;

		return {
			empfaengerIds: empfaenger.map((b) => b.id),
			typ: 'neues_interesse' as const,
			titel: 'Neues Interesse',
			text: `${mitglied.name} hat Interesse an ${spielBezeichnung(spiel)}.`,
			link: spielLink(spielId),
			ausloeserId: userId
		};
	});
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
