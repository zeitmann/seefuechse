import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { spiele as spieleTable, dauerkarten, freigaben, bewerbungen } from '$lib/server/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { toggleFreigabe, vergebenAn } from '$lib/server/freigaben';
import { hatAdminRolle } from '$lib/server/rollen';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const spiel = await db.query.spiele.findFirst({
		where: eq(spieleTable.id, params.id)
	});

	if (!spiel) error(404, 'Spiel nicht gefunden');

	const { user } = await locals.safeGetSession();
	const istAdmin = user ? await hatAdminRolle(user.id) : false;

	// Alle Freigaben für dieses Spiel – für jedes eingeloggte Mitglied sichtbar,
	// ohne weitere Rollen-Einschränkung. Ausnahme: zurückgezogene Freigaben
	// sieht nur der Admin.
	const freigabenRaw = await db.query.freigaben.findMany({
		where: istAdmin
			? eq(freigaben.spielId, spiel.id)
			: and(eq(freigaben.spielId, spiel.id), ne(freigaben.status, 'zurueckgezogen')),
		with: {
			dauerkarte: { with: { besitzer: true } },
			bewerbungen: {
				where: eq(bewerbungen.status, 'angenommen'),
				with: { mitglied: true }
			}
		}
	});

	const freigabenFuerSpiel = freigabenRaw.map((f) => ({
		id: f.id,
		status: f.status,
		besitzerName: f.dauerkarte.besitzer.name,
		kartenBezeichnung: f.dauerkarte.bezeichnung,
		empfaengerName:
			f.status === 'vergeben' ? (f.bewerbungen[0]?.mitglied.name ?? null) : null
	}));

	if (!user) {
		return { spiel, hasDauerkarte: false as const, freigabe: null, freigabenFuerSpiel };
	}

	const eigenesDauerkarte = await db.query.dauerkarten.findFirst({
		where: eq(dauerkarten.besitzerId, user.id)
	});

	if (!eigenesDauerkarte) {
		return { spiel, hasDauerkarte: false as const, freigabe: null, freigabenFuerSpiel };
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

	return { spiel, hasDauerkarte: true as const, freigabe, freigabenFuerSpiel };
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
