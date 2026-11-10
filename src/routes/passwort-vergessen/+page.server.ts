import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	// Kommt vom Callback, wenn der Link abgelaufen oder schon benutzt ist.
	return { linkUngueltig: url.searchParams.get('fehler') === 'link-ungueltig' };
};

export const actions: Actions = {
	// Öffentliche Aktion (kein Login nötig) – Schutz gegen Missbrauch übernimmt
	// das Rate-Limit von Supabase Auth.
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();

		if (!email || !email.includes('@')) {
			return fail(400, { fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.', email });
		}

		const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/auth/callback?next=/passwort-neu`
		});

		// Fehler nur loggen: Die Antwort bleibt immer neutral, damit nicht
		// verraten wird, ob zu der Adresse ein Konto existiert.
		if (error) {
			console.error('resetPasswordForEmail fehlgeschlagen:', error.message);
		}

		return { gesendet: true };
	}
};
