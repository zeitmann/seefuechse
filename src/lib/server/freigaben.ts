import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { dauerkarten, freigaben, bewerbungen, interesse } from '$lib/server/db/schema';
import { eq, and, ne, inArray } from 'drizzle-orm';

export async function toggleFreigabe(userId: string, spielId: string): Promise<void> {
	const eigenesDauerkarte = await db.query.dauerkarten.findFirst({
		where: eq(dauerkarten.besitzerId, userId)
	});
	if (!eigenesDauerkarte) error(403, 'Keine Dauerkarte');

	const vorhandeneFreigabe = await db.query.freigaben.findFirst({
		where: and(eq(freigaben.dauerkarteId, eigenesDauerkarte.id), eq(freigaben.spielId, spielId))
	});

	if (!vorhandeneFreigabe) {
		await db.insert(freigaben).values({
			dauerkarteId: eigenesDauerkarte.id,
			spielId,
			status: 'offen'
		});
	} else if (vorhandeneFreigabe.status === 'zurueckgezogen') {
		await db
			.update(freigaben)
			.set({ status: 'offen' })
			.where(eq(freigaben.id, vorhandeneFreigabe.id));
	} else if (vorhandeneFreigabe.status === 'offen') {
		await db
			.update(freigaben)
			.set({ status: 'zurueckgezogen' })
			.where(eq(freigaben.id, vorhandeneFreigabe.id));
	}
	// status === 'vergeben' → keine Wirkung
}

/** Nur die Schreib-Methoden, die beide Aufrufer brauchen – erfüllt von `db` wie von einer Transaktion. */
type Ausfuehrer = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;

/**
 * Setzt für eine bereits als "vergeben" markierte Freigabe die gewählte
 * Bewerbung auf 'angenommen' und alle übrigen auf 'abgelehnt'.
 *
 * Wird gemeinsam genutzt von:
 * - `vergebenAn` (es existiert immer eine Bewerbung → reines UPDATE),
 * - `vergebenAnMitInteresse` (Mitglied hatte evtl. nur Interesse → ggf. INSERT).
 *
 * Verhalten für `vergebenAn` bleibt identisch (Option `bewerbungAnlegenFallsFehlt: false`).
 */
async function bewerbungenNachVergabeSynchronisieren(
	exec: Ausfuehrer,
	freigabeId: string,
	angenommeneMitgliedId: string,
	{ bewerbungAnlegenFallsFehlt }: { bewerbungAnlegenFallsFehlt: boolean }
): Promise<void> {
	if (bewerbungAnlegenFallsFehlt) {
		const [vorhanden] = await exec
			.select({ id: bewerbungen.id })
			.from(bewerbungen)
			.where(
				and(
					eq(bewerbungen.freigabeId, freigabeId),
					eq(bewerbungen.mitgliedId, angenommeneMitgliedId)
				)
			)
			.limit(1);

		if (vorhanden) {
			await exec
				.update(bewerbungen)
				.set({ status: 'angenommen' })
				.where(eq(bewerbungen.id, vorhanden.id));
		} else {
			await exec.insert(bewerbungen).values({
				freigabeId,
				mitgliedId: angenommeneMitgliedId,
				status: 'angenommen'
			});
		}
	} else {
		await exec
			.update(bewerbungen)
			.set({ status: 'angenommen' })
			.where(
				and(
					eq(bewerbungen.freigabeId, freigabeId),
					eq(bewerbungen.mitgliedId, angenommeneMitgliedId)
				)
			);
	}

	await exec
		.update(bewerbungen)
		.set({ status: 'abgelehnt' })
		.where(
			and(eq(bewerbungen.freigabeId, freigabeId), ne(bewerbungen.mitgliedId, angenommeneMitgliedId))
		);
}

/**
 * Entfernt nach einer Vergabe den Interesse-Eintrag des Empfängers für das Spiel.
 * WHERE (mitglied_id, spiel_id) trifft wegen des Unique Constraints höchstens
 * eine Zeile; existiert keine, ist das DELETE ein harmloser No-Op.
 */
async function interesseNachVergabeEntfernen(
	exec: Ausfuehrer,
	spielId: string,
	empfaengerId: string
): Promise<void> {
	await exec
		.delete(interesse)
		.where(and(eq(interesse.mitgliedId, empfaengerId), eq(interesse.spielId, spielId)));
}

/**
 * Hat der Nutzer für dieses Spiel eine eigene Freigabe mit Status 'offen' oder
 * 'vergeben' (über irgendeine seiner Dauerkarten)? Besitz wird zur Laufzeit aus
 * dauerkarten.besitzer_id abgeleitet.
 */
export async function hatAktiveEigeneFreigabe(userId: string, spielId: string): Promise<boolean> {
	const eigeneDauerkarten = db
		.select({ id: dauerkarten.id })
		.from(dauerkarten)
		.where(eq(dauerkarten.besitzerId, userId));

	const treffer = await db.query.freigaben.findFirst({
		columns: { id: true },
		where: and(
			eq(freigaben.spielId, spielId),
			inArray(freigaben.status, ['offen', 'vergeben']),
			inArray(freigaben.dauerkarteId, eigeneDauerkarten)
		)
	});
	return treffer != null;
}

export async function vergebenAn(
	userId: string,
	freigabeId: string,
	mitgliedId: string
): Promise<void> {
	const freigabe = await db.query.freigaben.findFirst({
		where: eq(freigaben.id, freigabeId),
		with: { dauerkarte: true }
	});

	if (!freigabe || freigabe.dauerkarte.besitzerId !== userId) {
		error(403, 'Keine Berechtigung');
	}

	if (freigabe.status !== 'offen') return;

	await db.transaction(async (tx) => {
		// Bedingtes UPDATE als Race-Schutz: nur wenn die Freigabe noch 'offen' ist.
		const [vergeben] = await tx
			.update(freigaben)
			.set({ status: 'vergeben', vergebenAn: mitgliedId })
			.where(and(eq(freigaben.id, freigabeId), eq(freigaben.status, 'offen')))
			.returning({ spielId: freigaben.spielId });

		// Zwischenzeitlich anderweitig vergeben/zurückgezogen → nichts weiter tun.
		if (!vergeben) return;

		await bewerbungenNachVergabeSynchronisieren(tx, freigabeId, mitgliedId, {
			bewerbungAnlegenFallsFehlt: false
		});
		await interesseNachVergabeEntfernen(tx, vergeben.spielId, mitgliedId);
	});
}

/**
 * Dritter Einstiegspunkt zur Vergabe: DK-Besitzer vergibt seine Karte direkt an
 * ein Mitglied aus der Interesse-Liste – auch wenn dafür noch gar keine Freigabe
 * bzw. Bewerbung existiert. Alles in einer Transaktion.
 */
export async function vergebenAnMitInteresse(
	userId: string,
	dauerkarteId: string,
	spielId: string,
	mitgliedId: string
): Promise<void> {
	// 1. Autorisierung – unabhängig von der UI-Sichtbarkeit.
	const dauerkarte = await db.query.dauerkarten.findFirst({
		where: eq(dauerkarten.id, dauerkarteId)
	});
	if (!dauerkarte || dauerkarte.besitzerId !== userId) {
		error(403, 'Keine Berechtigung');
	}

	await db.transaction(async (tx) => {
		// 2. Freigabe für (dauerkarteId, spielId) finden bzw. anlegen.
		const vorhandeneFreigabe = await tx.query.freigaben.findFirst({
			where: and(eq(freigaben.dauerkarteId, dauerkarteId), eq(freigaben.spielId, spielId))
		});

		let vergebeneFreigabe: { id: string; spielId: string };

		if (!vorhandeneFreigabe) {
			const [neu] = await tx
				.insert(freigaben)
				.values({
					dauerkarteId,
					spielId,
					status: 'vergeben',
					vergebenAn: mitgliedId
				})
				.returning({ id: freigaben.id, spielId: freigaben.spielId });
			vergebeneFreigabe = neu;
		} else if (vorhandeneFreigabe.status === 'offen') {
			const [aktualisiert] = await tx
				.update(freigaben)
				.set({ status: 'vergeben', vergebenAn: mitgliedId })
				.where(and(eq(freigaben.id, vorhandeneFreigabe.id), eq(freigaben.status, 'offen')))
				.returning({ id: freigaben.id, spielId: freigaben.spielId });
			if (!aktualisiert) {
				// Zwischenzeitlich schon vergeben/geändert – nicht überschreiben.
				error(409, 'Die Freigabe ist nicht mehr offen.');
			}
			vergebeneFreigabe = aktualisiert;
		} else {
			// status === 'vergeben' oder 'zurueckgezogen' → kein Überschreiben.
			error(409, 'Für diese Dauerkarte besteht für dieses Spiel bereits eine Freigabe.');
		}

		// 3. + 4. Gewählte Bewerbung sicherstellen/annehmen, Rest ablehnen.
		await bewerbungenNachVergabeSynchronisieren(tx, vergebeneFreigabe.id, mitgliedId, {
			bewerbungAnlegenFallsFehlt: true
		});

		// 5. Interesse des Empfängers für dieses Spiel entfernen (Spiel-ID aus der Freigabe).
		await interesseNachVergabeEntfernen(tx, vergebeneFreigabe.spielId, mitgliedId);
	});
}
