import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { spiele as spieleTable, dauerkarten, freigaben } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { toggleFreigabe, vergebenAn } from '$lib/server/freigaben';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const spiel = await db.query.spiele.findFirst({
		where: eq(spieleTable.id, params.id)
	});

	if (!spiel) error(404, 'Spiel nicht gefunden');

	const { user } = await locals.safeGetSession();

	if (!user) {
		return { spiel, hasDauerkarte: false as const, freigabe: null };
	}

	const eigenesDauerkarte = await db.query.dauerkarten.findFirst({
		where: eq(dauerkarten.besitzerId, user.id)
	});

	if (!eigenesDauerkarte) {
		return { spiel, hasDauerkarte: false as const, freigabe: null };
	}

	const freigabe =
		(await db.query.freigaben.findFirst({
			where: and(
				eq(freigaben.dauerkarteId, eigenesDauerkarte.id),
				eq(freigaben.spielId, spiel.id)
			),
			with: {
				bewerbungen: { with: { mitglied: true } },
				vergebenAnMitglied: true
			}
		})) ?? null;

	return { spiel, hasDauerkarte: true as const, freigabe };
};

export const actions: Actions = {
	toggleFreigabe: async ({ params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');
		await toggleFreigabe(user.id, params.id);
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
