import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { dauerkarten, mitglieder } from '$lib/server/db/schema';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const passwort = String(form.get('passwort') ?? '');
		const passwortWdh = String(form.get('passwort_wdh') ?? '');
		const hatDauerkarte = form.get('hatDauerkarte') === 'on';

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

		const userId = data.user.id;

		// Mitglied und (optional) Dauerkarte gemeinsam anlegen: entweder beides
		// oder nichts. Der Auth-User bleibt bei einem Fehler bestehen.
		try {
			await db.transaction(async (tx) => {
				await tx.insert(mitglieder).values({
					id: userId,
					name,
					email,
					status: 'ausstehend'
				});

				// Selbstauskunft – der Vorstand prüft sie in der Verwaltung.
				if (hatDauerkarte) {
					await tx.insert(dauerkarten).values({
						besitzerId: userId,
						bezeichnung: `DK ${name}`
					});
				}
			});
		} catch (e) {
			console.error('Registrierung: Anlegen von Mitglied/Dauerkarte fehlgeschlagen', e);
			return fail(500, { fehler: 'Registrierung fehlgeschlagen.' });
		}

		return { erfolg: true };
	}
};
