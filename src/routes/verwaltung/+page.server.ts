import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mitglieder } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { hatVerwaltungsRolle, hatAdminRolle } from '$lib/server/rollen';
import { synchronisiereSpielplan } from '$lib/server/spielplanSync';
import { ermittleTerminierungsStichtag } from '$lib/server/spielplanTermine';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user || !(await hatVerwaltungsRolle(user.id))) {
		return {
			kannVerwalten: false,
			terminierungsStichtag: null,
			istAdmin: false,
			ausstehendeMitglieder: [] as { id: string; name: string; email: string }[]
		};
	}

	const istAdmin = await hatAdminRolle(user.id);

	const ausstehendeMitglieder = await db
		.select({ id: mitglieder.id, name: mitglieder.name, email: mitglieder.email })
		.from(mitglieder)
		.where(eq(mitglieder.status, 'ausstehend'));

	const terminierungsStichtag = await ermittleTerminierungsStichtag();

	return { kannVerwalten: true, istAdmin, ausstehendeMitglieder, terminierungsStichtag };
};

/** Saison des OpenLigaDB-Syncs (2026 = Saison 2026/27). */
const SYNC_SAISON = 2026;

export const actions: Actions = {
	/**
	 * Übernimmt den Spielplan aus OpenLigaDB. Rollenprüfung hier erneut, da
	 * Actions unabhängig vom load() direkt per POST erreichbar sind.
	 */
	synchronisieren: async ({ locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !(await hatVerwaltungsRolle(user.id))) {
			error(403, 'Keine Berechtigung');
		}

		const sync = await synchronisiereSpielplan(SYNC_SAISON);
		return { sync };
	},

	freischalten: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !(await hatVerwaltungsRolle(user.id))) {
			error(403, 'Keine Berechtigung');
		}

		const form = await request.formData();
		const mitgliedId = String(form.get('mitgliedId') ?? '');
		if (!mitgliedId) error(400, 'Fehlende Mitglied-ID');

		await db
			.update(mitglieder)
			.set({ status: 'aktiv' })
			.where(and(eq(mitglieder.id, mitgliedId), eq(mitglieder.status, 'ausstehend')));
	},

	ablehnen: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !(await hatVerwaltungsRolle(user.id))) {
			error(403, 'Keine Berechtigung');
		}

		const form = await request.formData();
		const mitgliedId = String(form.get('mitgliedId') ?? '');
		if (!mitgliedId) error(400, 'Fehlende Mitglied-ID');

		await db
			.update(mitglieder)
			.set({ status: 'abgelehnt' })
			.where(and(eq(mitglieder.id, mitgliedId), eq(mitglieder.status, 'ausstehend')));
	}
};
