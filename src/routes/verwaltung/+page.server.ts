import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mitglieder, syncLaeufe } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { hatVerwaltungsRolle, hatAdminRolle } from '$lib/server/rollen';
import { AKTUELLE_SAISON, fuehreSyncMitProtokollAus } from '$lib/server/spielplanSync';
import { ermittleTerminierungsStichtag } from '$lib/server/spielplanTermine';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user || !(await hatVerwaltungsRolle(user.id))) {
		return {
			kannVerwalten: false,
			terminierungsStichtag: null,
			letzterSync: null,
			syncSaison: AKTUELLE_SAISON,
			istAdmin: false,
			ausstehendeMitglieder: [] as { id: string; name: string; email: string }[]
		};
	}

	const istAdmin = await hatAdminRolle(user.id);

	const ausstehendeMitglieder = await db
		.select({ id: mitglieder.id, name: mitglieder.name, email: mitglieder.email })
		.from(mitglieder)
		.where(eq(mitglieder.status, 'ausstehend'));

	const [terminierungsStichtag, [letzterSync]] = await Promise.all([
		ermittleTerminierungsStichtag(),
		db
			.select({
				gestartetAm: syncLaeufe.gestartetAm,
				quelle: syncLaeufe.quelle,
				erfolgreich: syncLaeufe.erfolgreich,
				hinweise: syncLaeufe.hinweise
			})
			.from(syncLaeufe)
			.orderBy(desc(syncLaeufe.gestartetAm))
			.limit(1)
	]);

	return {
		kannVerwalten: true,
		istAdmin,
		ausstehendeMitglieder,
		terminierungsStichtag,
		letzterSync: letzterSync ?? null,
		syncSaison: AKTUELLE_SAISON
	};
};

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

		// Wirft nicht; Fehler landen als erfolgreich = false im Protokoll und Ergebnis.
		const sync = await fuehreSyncMitProtokollAus('manuell');
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
