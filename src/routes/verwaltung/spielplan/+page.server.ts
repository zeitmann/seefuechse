import { error, fail } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spiele } from '$lib/server/db/schema';
import { hatVerwaltungsRolle } from '$lib/server/rollen';
import { alsAktionsFehler } from '$lib/server/aktionen';
import {
	HEIM_AUSWAERTS_WERTE,
	WETTBEWERBE,
	spielAendern,
	spielAnlegen,
	spielEingabePruefen,
	spielLoeschen
} from '$lib/server/spiele';
import type { PageServerLoad, Actions } from './$types';

/**
 * Stellt sicher, dass der aufrufende Nutzer Admin oder Vorstand ist. Muss in
 * jeder Action erneut aufgerufen werden – der load-Guard schützt nur den
 * Seitenaufruf, nicht die einzeln ansprechbaren Server Actions.
 */
async function verwaltungPruefen(locals: App.Locals) {
	const { user } = await locals.safeGetSession();
	if (!user || !(await hatVerwaltungsRolle(user.id))) {
		error(403, 'Keine Berechtigung');
	}
}

/**
 * Wie alsAktionsFehler, ergänzt um `ziel` ('neu' oder Spiel-ID), damit die Seite
 * die Meldung beim richtigen Formular anzeigt.
 */
function fehlerMitZiel(e: unknown, ziel: string) {
	const ergebnis = alsAktionsFehler(e);
	return fail(ergebnis.status, { ...ergebnis.data, ziel });
}

export const load: PageServerLoad = async ({ locals }) => {
	await verwaltungPruefen(locals);

	const alleSpiele = await db
		.select({
			id: spiele.id,
			datum: spiele.datum,
			gegner: spiele.gegner,
			wettbewerb: spiele.wettbewerb,
			heimAuswaerts: spiele.heimAuswaerts
		})
		.from(spiele)
		.orderBy(asc(spiele.datum), asc(spiele.gegner));

	return {
		spiele: alleSpiele,
		wettbewerbe: WETTBEWERBE,
		heimAuswaertsWerte: HEIM_AUSWAERTS_WERTE
	};
};

export const actions: Actions = {
	spielAnlegen: async ({ request, locals }) => {
		await verwaltungPruefen(locals);

		const pruefung = spielEingabePruefen(await request.formData());
		if (!pruefung.ok) return fail(400, { fehler: pruefung.fehler, ziel: 'neu' });

		try {
			await spielAnlegen(pruefung.daten);
		} catch (e) {
			return fehlerMitZiel(e, 'neu');
		}
		return { erfolg: 'Spiel angelegt.', ziel: 'neu' };
	},

	spielAendern: async ({ request, locals }) => {
		await verwaltungPruefen(locals);

		const form = await request.formData();
		const spielId = String(form.get('spielId') ?? '');
		if (!spielId) error(400, 'Fehlende Spiel-ID');

		const pruefung = spielEingabePruefen(form);
		if (!pruefung.ok) return fail(400, { fehler: pruefung.fehler, ziel: spielId });

		try {
			await spielAendern(spielId, pruefung.daten);
		} catch (e) {
			return fehlerMitZiel(e, spielId);
		}
		return { erfolg: 'Spiel gespeichert.', ziel: spielId };
	},

	spielLoeschen: async ({ request, locals }) => {
		await verwaltungPruefen(locals);

		const form = await request.formData();
		const spielId = String(form.get('spielId') ?? '');
		if (!spielId) error(400, 'Fehlende Spiel-ID');

		try {
			await spielLoeschen(spielId);
		} catch (e) {
			return fehlerMitZiel(e, spielId);
		}
		return { erfolg: 'Spiel gelöscht.', ziel: spielId };
	}
};
