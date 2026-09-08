import { db } from '$lib/server/db';
import { mitglieder, dauerkarten } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hatVerwaltungsRolle } from '$lib/server/rollen';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	let mitgliedStatus: 'ausstehend' | 'aktiv' | 'abgelehnt' | null = null;
	let hasDauerkarte = false;
	let kannVerwalten = false;

	if (user) {
		const rows = await db
			.select({ status: mitglieder.status })
			.from(mitglieder)
			.where(eq(mitglieder.id, user.id))
			.limit(1);
		mitgliedStatus = rows[0]?.status ?? null;

		const eigeneDauerkarte = await db
			.select({ id: dauerkarten.id })
			.from(dauerkarten)
			.where(eq(dauerkarten.besitzerId, user.id))
			.limit(1);
		hasDauerkarte = eigeneDauerkarte.length > 0;

		kannVerwalten = await hatVerwaltungsRolle(user.id);
	}

	return { session, user, mitgliedStatus, hasDauerkarte, kannVerwalten };
};
