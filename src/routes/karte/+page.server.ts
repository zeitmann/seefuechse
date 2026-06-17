import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { dauerkarten, spiele as spieleTable, freigaben } from '$lib/server/db/schema';
import { eq, gte, asc } from 'drizzle-orm';
import { toggleFreigabe, vergebenAn } from '$lib/server/freigaben';
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

	const heute = new Date().toISOString().slice(0, 10);

	const kommendeSpiele = await db.query.spiele.findMany({
		where: gte(spieleTable.datum, heute),
		orderBy: asc(spieleTable.datum)
	});

	const meineFreigaben = await db.query.freigaben.findMany({
		where: eq(freigaben.dauerkarteId, eigenesDauerkarte.id),
		with: {
			bewerbungen: { with: { mitglied: true } },
			vergebenAnMitglied: true
		}
	});

	const spieleMitFreigabe = kommendeSpiele.map((spiel) => {
		const freigabe = meineFreigaben.find((f) => f.spielId === spiel.id) ?? null;
		return { spiel, freigabe };
	});

	const freigegebenCount = meineFreigaben.filter((f) => f.status === 'offen').length;

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

		await toggleFreigabe(user.id, spielId);
	},

	vergeben: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const freigabeId = String(form.get('freigabeId') ?? '');
		const mitgliedId = String(form.get('mitgliedId') ?? '');
		if (!freigabeId || !mitgliedId) error(400, 'Fehlende Daten');

		await vergebenAn(user.id, freigabeId, mitgliedId);
	}
};
