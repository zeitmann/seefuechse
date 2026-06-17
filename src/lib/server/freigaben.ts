import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { dauerkarten, freigaben, bewerbungen } from '$lib/server/db/schema';
import { eq, and, ne } from 'drizzle-orm';

export async function toggleFreigabe(userId: string, spielId: string): Promise<void> {
	const eigenesDauerkarte = await db.query.dauerkarten.findFirst({
		where: eq(dauerkarten.besitzerId, userId)
	});
	if (!eigenesDauerkarte) error(403, 'Keine Dauerkarte');

	const vorhandeneFreigabe = await db.query.freigaben.findFirst({
		where: and(eq(freigaben.dauerkarteId, eigenesDauerkarte.id), eq(freigaben.spielId, spielId))
	});

	if (!vorhandeneFreigabe) {
		await db.insert(freigaben).values({
			dauerkarteId: eigenesDauerkarte.id,
			spielId,
			status: 'offen'
		});
	} else if (vorhandeneFreigabe.status === 'zurueckgezogen') {
		await db
			.update(freigaben)
			.set({ status: 'offen' })
			.where(eq(freigaben.id, vorhandeneFreigabe.id));
	} else if (vorhandeneFreigabe.status === 'offen') {
		await db
			.update(freigaben)
			.set({ status: 'zurueckgezogen' })
			.where(eq(freigaben.id, vorhandeneFreigabe.id));
	}
	// status === 'vergeben' → keine Wirkung
}

export async function vergebenAn(
	userId: string,
	freigabeId: string,
	mitgliedId: string
): Promise<void> {
	const freigabe = await db.query.freigaben.findFirst({
		where: eq(freigaben.id, freigabeId),
		with: { dauerkarte: true }
	});

	if (!freigabe || freigabe.dauerkarte.besitzerId !== userId) {
		error(403, 'Keine Berechtigung');
	}

	if (freigabe.status !== 'offen') return;

	await db
		.update(freigaben)
		.set({ status: 'vergeben', vergebenAn: mitgliedId })
		.where(and(eq(freigaben.id, freigabeId), eq(freigaben.status, 'offen')));

	await db
		.update(bewerbungen)
		.set({ status: 'angenommen' })
		.where(and(eq(bewerbungen.freigabeId, freigabeId), eq(bewerbungen.mitgliedId, mitgliedId)));

	await db
		.update(bewerbungen)
		.set({ status: 'abgelehnt' })
		.where(and(eq(bewerbungen.freigabeId, freigabeId), ne(bewerbungen.mitgliedId, mitgliedId)));
}
