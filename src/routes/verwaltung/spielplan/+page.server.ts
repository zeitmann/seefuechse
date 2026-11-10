import { error, fail } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spiele } from '$lib/server/db/schema';
import { hatVerwaltungsRolle } from '$lib/server/rollen';
import { alsAktionsFehler } from '$lib/server/aktionen';
import {
	HEIM_AUSWAERTS_WERTE,
	WETTBEWERBE,
	gegnerVereinheitlichen,
	spielAendern,
	spielAnlegen,
	spielEingabePruefen,
	spielLoeschen,
	vorhandeneGegner,
	type SpielDaten
} from '$lib/server/spiele';
import { findeSchreibvarianten } from '$lib/server/vereinsnamen';
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

/**
 * Ersetzt den Gegner durch den kanonischen Namen. Bei einem ähnlichen Treffer
 * ohne Entscheidung des Verwalters kommt stattdessen fail(409) mit Vorschlag
 * und den Formularwerten zurück – es wird nichts gespeichert.
 */
async function mitKanonischemGegner(daten: SpielDaten, form: FormData, ziel: string) {
	const entscheidung = String(form.get('namensEntscheidung') ?? '');
	const ergebnis = await gegnerVereinheitlichen(daten.gegner, entscheidung);
	if (!ergebnis.ok) {
		return { fehlschlag: fail(409, { ziel, werte: daten, vorschlag: ergebnis.vorschlag }) };
	}
	return { daten: { ...daten, gegner: ergebnis.gegner } };
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

	const vereinsnamen = await vorhandeneGegner();

	return {
		spiele: alleSpiele,
		vereinsnamen,
		schreibvarianten: findeSchreibvarianten(vereinsnamen),
		wettbewerbe: WETTBEWERBE,
		heimAuswaertsWerte: HEIM_AUSWAERTS_WERTE
	};
};

export const actions: Actions = {
	spielAnlegen: async ({ request, locals }) => {
		await verwaltungPruefen(locals);

		const form = await request.formData();
		const pruefung = spielEingabePruefen(form);
		if (!pruefung.ok) return fail(400, { fehler: pruefung.fehler, ziel: 'neu' });

		const kanonisch = await mitKanonischemGegner(pruefung.daten, form, 'neu');
		if ('fehlschlag' in kanonisch) return kanonisch.fehlschlag;

		try {
			await spielAnlegen(kanonisch.daten);
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

		const kanonisch = await mitKanonischemGegner(pruefung.daten, form, spielId);
		if ('fehlschlag' in kanonisch) return kanonisch.fehlschlag;

		try {
			await spielAendern(spielId, kanonisch.daten);
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
