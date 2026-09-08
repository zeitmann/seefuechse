import { db } from '$lib/server/db';
import { mitgliedRollen, rollen } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Prüft, ob das Mitglied eine Verwaltungsrolle (admin oder vorstand) besitzt.
 */
export async function hatVerwaltungsRolle(userId: string): Promise<boolean> {
	const rows = await db
		.select({ name: rollen.name })
		.from(mitgliedRollen)
		.innerJoin(rollen, eq(mitgliedRollen.rolleId, rollen.id))
		.where(eq(mitgliedRollen.mitgliedId, userId));

	return rows.some((r) => r.name === 'admin' || r.name === 'vorstand');
}
