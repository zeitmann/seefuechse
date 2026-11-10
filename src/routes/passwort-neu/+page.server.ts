import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MIN_LAENGE = 6;

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	return { minLaenge: MIN_LAENGE };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login');

		const form = await request.formData();
		const passwort = String(form.get('passwort') ?? '');
		const passwortWdh = String(form.get('passwort_wdh') ?? '');

		if (passwort.length < MIN_LAENGE) {
			return fail(400, { fehler: `Das Passwort muss mindestens ${MIN_LAENGE} Zeichen lang sein.` });
		}
		if (passwort !== passwortWdh) {
			return fail(400, { fehler: 'Die Passwörter stimmen nicht überein.' });
		}

		const { error } = await locals.supabase.auth.updateUser({ password: passwort });
		if (error) {
			return fail(400, { fehler: uebersetzeFehler(error.code, error.message) });
		}

		redirect(303, '/?passwort=geaendert');
	}
};

function uebersetzeFehler(code: string | undefined, nachricht: string): string {
	switch (code) {
		case 'same_password':
			return 'Das neue Passwort muss sich vom bisherigen unterscheiden.';
		case 'weak_password':
			return 'Das Passwort ist zu schwach. Bitte wähle ein längeres oder komplexeres Passwort.';
		case 'reauthentication_needed':
			return 'Der Link ist abgelaufen. Bitte fordere über „Passwort vergessen“ einen neuen an.';
		default:
			return `Passwort konnte nicht geändert werden: ${nachricht}`;
	}
}
