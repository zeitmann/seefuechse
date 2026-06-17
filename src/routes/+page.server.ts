import { db } from '$lib/server/db';
import { mitglieder, spiele, freigaben } from '$lib/server/db/schema';
import { eq, gte, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		return {
			mitgliedName: '',
			meineDauerkarte: null,
			isCardOwner: false,
			meineOffenenFreigaben: [],
			naechsteSpiele: [],
			alleFreienKarten: []
		};
	}

	const eigenesMitglied = await db.query.mitglieder.findFirst({
		where: eq(mitglieder.id, user.id),
		with: { dauerkarten: true }
	});

	const eigeneDauerkartenIds = (eigenesMitglied?.dauerkarten ?? []).map((dk) => dk.id);
	const meineDauerkarte = eigenesMitglied?.dauerkarten?.[0] ?? null;

	const heute = new Date().toISOString().slice(0, 10);

	const naechsteSpieleRaw = await db.query.spiele.findMany({
		where: gte(spiele.datum, heute),
		orderBy: asc(spiele.datum),
		limit: 3
	});

	const offeneFreigaben = await db.query.freigaben.findMany({
		where: eq(freigaben.status, 'offen'),
		with: {
			dauerkarte: { with: { besitzer: true } },
			spiel: true,
			bewerbungen: { with: { mitglied: true } }
		}
	});

	const naechsteSpiele = naechsteSpieleRaw.map((spiel) => ({
		...spiel,
		freeCount: offeneFreigaben.filter((f) => f.spielId === spiel.id).length
	}));

	const meineOffenenFreigaben = offeneFreigaben.filter((f) =>
		eigeneDauerkartenIds.includes(f.dauerkarteId)
	);

	const alleFreienKarten = offeneFreigaben.map((f) => ({
		freigabeId: f.id,
		besitzerName: f.dauerkarte.besitzer.name,
		spielGegner: f.spiel.gegner,
		spielDatum: f.spiel.datum,
		applicationCount: f.bewerbungen.length
	}));

	return {
		mitgliedName: eigenesMitglied?.name ?? '',
		meineDauerkarte,
		isCardOwner: !!meineDauerkarte,
		meineOffenenFreigaben,
		naechsteSpiele,
		alleFreienKarten
	};
};
