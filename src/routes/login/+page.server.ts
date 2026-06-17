import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mitglieder } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const passwort = String(form.get('passwort') ?? '');

		const { error, data } = await locals.supabase.auth.signInWithPassword({
			email,
			password: passwort
		});

		if (error || !data.user) {
			return fail(400, { fehler: 'E-Mail oder Passwort falsch.' });
		}

		const rows = await db
			.select({ status: mitglieder.status })
			.from(mitglieder)
			.where(eq(mitglieder.id, data.user.id))
			.limit(1);
		const status = rows[0]?.status;

		if (status === 'aktiv') {
			redirect(303, '/');
		} else {
			redirect(303, '/warten');
		}
	}
};
