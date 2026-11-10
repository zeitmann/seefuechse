import { db } from '$lib/server/db';
import { spiele as spieleTable, freigaben } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const alleSpiele = await db.query.spiele.findMany({
		// Nach Datum, dann Anpfiff; Postgres sortiert NULL bei ASC zuletzt (ohne Uhrzeit hinten).
		orderBy: [asc(spieleTable.datum), asc(spieleTable.uhrzeit)]
	});

	const offeneFreigaben = await db
		.select({ spielId: freigaben.spielId })
		.from(freigaben)
		.where(eq(freigaben.status, 'offen'));

	const spiele = alleSpiele.map((spiel) => ({
		...spiel,
		freeCount: offeneFreigaben.filter((f) => f.spielId === spiel.id).length
	}));

	return { spiele };
};
