import { fail, isHttpError } from '@sveltejs/kit';

/**
 * Wandelt erwartbare Geschäftsfehler aus Form-Actions in eine Meldung für die
 * Seite um, statt eine Fehlerseite anzuzeigen.
 *
 * - SvelteKit-HttpError mit 404 oder 409 → `fail(status, { fehler })`
 * - alles andere (403, 400, unerwartete Fehler) → unverändert weiterwerfen
 *
 * Verwendung im catch-Block einer Action: `return alsAktionsFehler(e);`
 */
export function alsAktionsFehler(e: unknown) {
	if (isHttpError(e) && (e.status === 404 || e.status === 409)) {
		return fail(e.status, { fehler: e.body.message });
	}
	throw e;
}
