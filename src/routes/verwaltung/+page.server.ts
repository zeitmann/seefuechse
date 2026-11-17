import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mitglieder, syncLaeufe } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { hatVerwaltungsRolle, hatAdminRolle } from '$lib/server/rollen';
import { AKTUELLE_SAISON, fuehreSyncMitProtokollAus } from '$lib/server/spielplanSync';
import { ermittleTerminierungsStichtag } from '$lib/server/spielplanTermine';
import {
	holeSyncIntervall,
	istSyncIntervall,
	setzeSyncIntervall,
	STANDARD_SYNC_INTERVALL,
	type SyncIntervall
} from '$lib/server/syncEinstellung';
import {
	dauerkartenUebersicht,
	dauerkarteEntfernen,
	type DauerkartenEintrag
} from '$lib/server/dauerkarten';
import { UUID_MUSTER } from '$lib/server/spiele';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user || !(await hatVerwaltungsRolle(user.id))) {
		return {
			kannVerwalten: false,
			terminierungsStichtag: null,
			letzterSync: null,
			syncSaison: AKTUELLE_SAISON,
			syncIntervall: STANDARD_SYNC_INTERVALL as SyncIntervall,
			istAdmin: false,
			ausstehendeMitglieder: [] as { id: string; name: string; email: string }[],
			dauerkarten: [] as DauerkartenEintrag[]
		};
	}

	const istAdmin = await hatAdminRolle(user.id);

	const ausstehendeMitglieder = await db
		.select({ id: mitglieder.id, name: mitglieder.name, email: mitglieder.email })
		.from(mitglieder)
		.where(eq(mitglieder.status, 'ausstehend'));

	const [terminierungsStichtag, [letzterSync], dauerkarten, syncIntervall] = await Promise.all([
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
			.limit(1),
		dauerkartenUebersicht(),
		holeSyncIntervall()
	]);

	return {
		kannVerwalten: true,
		istAdmin,
		ausstehendeMitglieder,
		terminierungsStichtag,
		letzterSync: letzterSync ?? null,
		syncSaison: AKTUELLE_SAISON,
		syncIntervall,
		dauerkarten
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

	/** Legt fest, wie oft der automatische Sync (Cron) tatsächlich synchronisiert. */
	syncIntervallSetzen: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !(await hatVerwaltungsRolle(user.id))) {
			error(403, 'Keine Berechtigung');
		}

		const form = await request.formData();
		const intervall = form.get('intervall');
		if (!istSyncIntervall(intervall)) {
			return fail(400, { intervallFehler: 'Ungültiges Intervall' });
		}

		await setzeSyncIntervall(intervall);
		return { intervallGespeichert: true };
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
	},

	/**
	 * Entfernt eine Dauerkarte samt Freigaben und Bewerbungen (ON DELETE CASCADE).
	 * Idempotent: eine bereits entfernte Karte ist kein Fehler.
	 */
	dauerkarteEntfernen: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !(await hatVerwaltungsRolle(user.id))) {
			error(403, 'Keine Berechtigung');
		}

		const form = await request.formData();
		const dauerkarteId = String(form.get('dauerkarteId') ?? '').trim();
		if (!dauerkarteId || !UUID_MUSTER.test(dauerkarteId)) {
			return fail(400, { dauerkarteFehler: 'Ungültige Dauerkarten-ID.' });
		}

		const entfernt = await dauerkarteEntfernen(dauerkarteId);
		return {
			dauerkarteMeldung: entfernt
				? 'Dauerkarte entfernt.'
				: 'Diese Dauerkarte war bereits entfernt.'
		};
	}
};
