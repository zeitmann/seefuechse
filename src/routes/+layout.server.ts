import { db } from '$lib/server/db';
import { mitglieder } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	let mitgliedStatus: 'ausstehend' | 'aktiv' | 'abgelehnt' | null = null;
	if (user) {
		const rows = await db
			.select({ status: mitglieder.status })
			.from(mitglieder)
			.where(eq(mitglieder.id, user.id))
			.limit(1);
		mitgliedStatus = rows[0]?.status ?? null;
	}

	return { session, user, mitgliedStatus };
};
