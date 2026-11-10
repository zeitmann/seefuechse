import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { benachrichtigungen } from '$lib/server/db/schema';
import {
	alleAlsGelesenMarkieren,
	alsGelesenMarkieren,
	benachrichtigungenListe
} from '$lib/server/benachrichtigungen';
import type { PageServerLoad, Actions } from './$types';

const LISTE = '/benachrichtigungen';
const UUID_MUSTER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nur relative Pfade innerhalb der App zulassen (kein Open Redirect über '//host'). */
function sichererLink(link: string): string {
	return link.startsWith('/') && !link.startsWith('//') ? link : LISTE;
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return { benachrichtigungen: [] };

	return { benachrichtigungen: await benachrichtigungenListe(user.id, 50) };
};

export const actions: Actions = {
	oeffnen: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		// Ungültige ID gar nicht erst an die DB schicken (uuid-Spalte würde sonst werfen).
		if (!UUID_MUSTER.test(id)) redirect(303, LISTE);

		// Autorisierung über die WHERE-Klausel: nur eigene Benachrichtigungen.
		const eintrag = await db.query.benachrichtigungen.findFirst({
			columns: { link: true },
			where: and(eq(benachrichtigungen.id, id), eq(benachrichtigungen.mitgliedId, user.id))
		});
		// Fremd oder unbekannt → zurück auf die Liste.
		if (!eintrag) redirect(303, LISTE);

		await alsGelesenMarkieren(user.id, id);
		redirect(303, sichererLink(eintrag.link));
	},

	alleGelesen: async ({ locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		await alleAlsGelesenMarkieren(user.id);
	}
};
