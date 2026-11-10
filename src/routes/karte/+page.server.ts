import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { dauerkarten, spiele as spieleTable, freigaben, interesse } from '$lib/server/db/schema';
import { eq, asc, count, inArray } from 'drizzle-orm';
import { toggleFreigabe, vergebenAn } from '$lib/server/freigaben';
import { alsAktionsFehler } from '$lib/server/aktionen';
import { istSpielOffen } from '$lib/server/spielStatus';
import { heuteDatum } from '$lib/spielAnzeige';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		return { hasDauerkarte: false as const };
	}

	const eigenesDauerkarte = await db.query.dauerkarten.findFirst({
		where: eq(dauerkarten.besitzerId, user.id)
	});

	if (!eigenesDauerkarte) {
		return { hasDauerkarte: false as const };
	}

	const heute = heuteDatum();

	// Nur offene Spiele (ab heute in Berlin und ohne Ergebnis) – gefiltert mit der
	// gemeinsamen Regel aus spielStatus.ts, damit sie nur an einer Stelle steht.
	// Die Saison hat wenige Dutzend Spiele, daher Filtern nach dem Laden.
	const kommendeSpiele = (
		await db.query.spiele.findMany({
			// Nach Datum, dann Anpfiff; Postgres sortiert NULL bei ASC zuletzt (ohne Uhrzeit hinten).
			orderBy: [asc(spieleTable.datum), asc(spieleTable.uhrzeit)]
		})
	).filter((spiel) => istSpielOffen(spiel, heute));

	const meineFreigaben = await db.query.freigaben.findMany({
		where: eq(freigaben.dauerkarteId, eigenesDauerkarte.id),
		with: {
			bewerbungen: { with: { mitglied: true } },
			vergebenAnMitglied: true
		}
	});

	// Anzahl angemeldeter Interessenten je Spiel – eine gruppierte COUNT-Abfrage
	// für alle kommenden Spiele statt N+1-Einzelabfragen. Rein informativ.
	const spielIds = kommendeSpiele.map((s) => s.id);
	const interesseCounts = spielIds.length
		? await db
				.select({ spielId: interesse.spielId, anzahl: count() })
				.from(interesse)
				.where(inArray(interesse.spielId, spielIds))
				.groupBy(interesse.spielId)
		: [];
	const interesseProSpiel = new Map(interesseCounts.map((r) => [r.spielId, r.anzahl]));

	const spieleMitFreigabe = kommendeSpiele.map((spiel) => {
		const freigabe = meineFreigaben.find((f) => f.spielId === spiel.id) ?? null;
		return { spiel, freigabe, interesseAnzahl: interesseProSpiel.get(spiel.id) ?? 0 };
	});

	// Zählt nur offene Freigaben zu offenen Spielen (wie die Liste darunter).
	const freigegebenCount = spieleMitFreigabe.filter((s) => s.freigabe?.status === 'offen').length;

	return {
		hasDauerkarte: true as const,
		dauerkarte: eigenesDauerkarte,
		freigegebenCount,
		spieleMitFreigabe
	};
};

export const actions: Actions = {
	toggleFreigabe: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const spielId = String(form.get('spielId') ?? '');
		if (!spielId) error(400, 'Fehlende Spiel-ID');

		try {
			await toggleFreigabe(user.id, spielId);
		} catch (e) {
			// z. B. 409 "Dieses Spiel hat bereits stattgefunden."
			return alsAktionsFehler(e);
		}
	},

	vergeben: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const freigabeId = String(form.get('freigabeId') ?? '');
		const mitgliedId = String(form.get('mitgliedId') ?? '');
		if (!freigabeId || !mitgliedId) error(400, 'Fehlende Daten');

		try {
			await vergebenAn(user.id, freigabeId, mitgliedId);
		} catch (e) {
			return alsAktionsFehler(e);
		}
	}
};
