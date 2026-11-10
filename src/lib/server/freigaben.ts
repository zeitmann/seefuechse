import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	dauerkarten,
	freigaben,
	bewerbungen,
	interesse,
	mitglieder,
	spiele
} from '$lib/server/db/schema';
import { eq, and, ne, inArray } from 'drizzle-orm';
import {
	benachrichtigenOhneFehler,
	kuerzlichBenachrichtigt,
	spielBezeichnung,
	spielLink
} from '$lib/server/benachrichtigungen';

export async function toggleFreigabe(userId: string, spielId: string): Promise<void> {
	const eigenesDauerkarte = await db.query.dauerkarten.findFirst({
		where: eq(dauerkarten.besitzerId, userId),
		with: { besitzer: { columns: { name: true } } }
	});
	if (!eigenesDauerkarte) error(403, 'Keine Dauerkarte');

	const vorhandeneFreigabe = await db.query.freigaben.findFirst({
		where: and(eq(freigaben.dauerkarteId, eigenesDauerkarte.id), eq(freigaben.spielId, spielId))
	});

	// Nur wenn die Freigabe danach 'offen' ist, wird benachrichtigt.
	let jetztOffen = false;

	if (!vorhandeneFreigabe) {
		await db.insert(freigaben).values({
			dauerkarteId: eigenesDauerkarte.id,
			spielId,
			status: 'offen'
		});
		jetztOffen = true;
	} else if (vorhandeneFreigabe.status === 'zurueckgezogen') {
		await db
			.update(freigaben)
			.set({ status: 'offen' })
			.where(eq(freigaben.id, vorhandeneFreigabe.id));
		jetztOffen = true;
	} else if (vorhandeneFreigabe.status === 'offen') {
		await db
			.update(freigaben)
			.set({ status: 'zurueckgezogen' })
			.where(eq(freigaben.id, vorhandeneFreigabe.id));
	}
	// status === 'vergeben' → keine Wirkung

	if (!jetztOffen) return;

	const besitzerName = eigenesDauerkarte.besitzer.name;
	await benachrichtigenOhneFehler(async () => {
		const [spiel, aktive] = await Promise.all([
			db.query.spiele.findFirst({
				columns: { gegner: true, heimAuswaerts: true },
				where: eq(spiele.id, spielId)
			}),
			db
				.select({ id: mitglieder.id })
				.from(mitglieder)
				.where(eq(mitglieder.status, 'aktiv'))
		]);
		if (!spiel) return null;

		const daten = {
			empfaengerIds: aktive.map((m) => m.id),
			typ: 'karte_freigegeben' as const,
			titel: 'Karte freigegeben',
			text: `${besitzerName} hat eine Karte für ${spielBezeichnung(spiel)} freigegeben.`,
			link: spielLink(spielId),
			ausloeserId: userId
		};
		// Spam-Schutz bei schnellem Hin- und Herschalten: gleiche Meldung höchstens
		// einmal pro Stunde.
		if (await kuerzlichBenachrichtigt(daten, 60)) return null;
		return daten;
	});
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
 * Gibt die mitgliedIds der dabei abgelehnten Anfragen zurück.
 */
async function bewerbungenNachVergabeSynchronisieren(
	exec: Ausfuehrer,
	freigabeId: string,
	angenommeneMitgliedId: string,
	{ bewerbungAnlegenFallsFehlt }: { bewerbungAnlegenFallsFehlt: boolean }
): Promise<string[]> {
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

	// Nur noch offene Anfragen kippen auf 'abgelehnt'; deren Mitglieder werden
	// zurückgegeben (für die Benachrichtigung nach dem Commit).
	const abgelehnt = await exec
		.update(bewerbungen)
		.set({ status: 'abgelehnt' })
		.where(
			and(
				eq(bewerbungen.freigabeId, freigabeId),
				ne(bewerbungen.mitgliedId, angenommeneMitgliedId),
				eq(bewerbungen.status, 'angefragt')
			)
		)
		.returning({ mitgliedId: bewerbungen.mitgliedId });
	return abgelehnt.map((b) => b.mitgliedId);
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
 * Benachrichtigt nach einer abgeschlossenen Vergabe die angenommene Person und
 * alle abgelehnten Personen. Wirft nie (siehe benachrichtigenOhneFehler).
 */
async function nachVergabeBenachrichtigen(
	besitzerId: string,
	spiel: { id: string; gegner: string; heimAuswaerts: 'heim' | 'auswaerts' },
	angenommeneMitgliedId: string,
	abgelehnteMitgliedIds: string[]
): Promise<void> {
	const bezeichnung = spielBezeichnung(spiel);
	const link = spielLink(spiel.id);

	await Promise.all([
		benachrichtigenOhneFehler({
			empfaengerIds: [angenommeneMitgliedId],
			typ: 'anfrage_angenommen',
			titel: 'Anfrage angenommen',
			text: `Du bekommst die Karte für ${bezeichnung}.`,
			link,
			ausloeserId: besitzerId
		}),
		benachrichtigenOhneFehler({
			empfaengerIds: abgelehnteMitgliedIds,
			typ: 'anfrage_abgelehnt',
			titel: 'Anfrage abgelehnt',
			text: `Die Karte für ${bezeichnung} wurde an jemand anderen vergeben.`,
			link,
			ausloeserId: besitzerId
		})
	]);
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
		with: { dauerkarte: true, spiel: true }
	});

	if (!freigabe || freigabe.dauerkarte.besitzerId !== userId) {
		error(403, 'Keine Berechtigung');
	}

	if (freigabe.status !== 'offen') return;

	const abgelehnteIds = await db.transaction(async (tx) => {
		// Bedingtes UPDATE als Race-Schutz: nur wenn die Freigabe noch 'offen' ist.
		const [vergeben] = await tx
			.update(freigaben)
			.set({ status: 'vergeben', vergebenAn: mitgliedId })
			.where(and(eq(freigaben.id, freigabeId), eq(freigaben.status, 'offen')))
			.returning({ spielId: freigaben.spielId });

		// Zwischenzeitlich anderweitig vergeben/zurückgezogen → nichts weiter tun.
		if (!vergeben) return null;

		const abgelehnt = await bewerbungenNachVergabeSynchronisieren(tx, freigabeId, mitgliedId, {
			bewerbungAnlegenFallsFehlt: false
		});
		await interesseNachVergabeEntfernen(tx, vergeben.spielId, mitgliedId);
		return abgelehnt;
	});

	// Keine Vergabe (Race) → keine Benachrichtigung. Sonst erst nach dem Commit.
	if (!abgelehnteIds) return;
	await nachVergabeBenachrichtigen(userId, freigabe.spiel, mitgliedId, abgelehnteIds);
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

	const vergabe = await db.transaction(async (tx) => {
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
		const abgelehnteIds = await bewerbungenNachVergabeSynchronisieren(
			tx,
			vergebeneFreigabe.id,
			mitgliedId,
			{ bewerbungAnlegenFallsFehlt: true }
		);

		// 5. Interesse des Empfängers für dieses Spiel entfernen (Spiel-ID aus der Freigabe).
		await interesseNachVergabeEntfernen(tx, vergebeneFreigabe.spielId, mitgliedId);

		return { spielId: vergebeneFreigabe.spielId, abgelehnteIds };
	});

	// 6. Nach dem Commit benachrichtigen (Fehler beim Laden des Spiels werden geloggt).
	try {
		const spiel = await db.query.spiele.findFirst({ where: eq(spiele.id, vergabe.spielId) });
		if (spiel) {
			await nachVergabeBenachrichtigen(userId, spiel, mitgliedId, vergabe.abgelehnteIds);
		}
	} catch (e) {
		console.error('Benachrichtigung nach Vergabe fehlgeschlagen:', e);
	}
}
