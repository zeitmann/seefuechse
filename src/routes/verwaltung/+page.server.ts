import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mitglieder, mitgliedRollen, rollen } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

async function hatVerwaltungsRolle(userId: string): Promise<boolean> {
	const rows = await db
		.select({ name: rollen.name })
		.from(mitgliedRollen)
		.innerJoin(rollen, eq(mitgliedRollen.rolleId, rollen.id))
		.where(eq(mitgliedRollen.mitgliedId, userId));

	return rows.some((r) => r.name === 'admin' || r.name === 'vorstand');
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user || !(await hatVerwaltungsRolle(user.id))) {
		return { kannVerwalten: false, ausstehendeMitglieder: [] as { id: string; name: string; email: string }[] };
	}

	const ausstehendeMitglieder = await db
		.select({ id: mitglieder.id, name: mitglieder.name, email: mitglieder.email })
		.from(mitglieder)
		.where(eq(mitglieder.status, 'ausstehend'));

	return { kannVerwalten: true, ausstehendeMitglieder };
};

export const actions: Actions = {
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
	}
};
