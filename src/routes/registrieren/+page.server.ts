import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mitglieder } from '$lib/server/db/schema';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const passwort = String(form.get('passwort') ?? '');
		const passwortWdh = String(form.get('passwort_wdh') ?? '');

		if (!name || !email || !passwort) {
			return fail(400, { fehler: 'Bitte alle Felder ausfüllen.' });
		}
		if (passwort !== passwortWdh) {
			return fail(400, { fehler: 'Passwörter stimmen nicht überein.' });
		}
		if (passwort.length < 6) {
			return fail(400, { fehler: 'Passwort muss mindestens 6 Zeichen lang sein.' });
		}

		const { data, error } = await locals.supabase.auth.signUp({ email, password: passwort });

		if (error || !data.user) {
			return fail(400, { fehler: error?.message ?? 'Registrierung fehlgeschlagen.' });
		}

		await db.insert(mitglieder).values({
			id: data.user.id,
			name,
			email,
			status: 'ausstehend'
		});

		return { erfolg: true };
	}
};
