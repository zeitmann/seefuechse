import { db } from '$lib/server/db';
import { mitglieder, spiele, freigaben } from '$lib/server/db/schema';
import { and, eq, gte, asc, isNull } from 'drizzle-orm';
import { heuteDatum } from '$lib/spielAnzeige';
import { istSpielOffen } from '$lib/server/spielStatus';
import {
	ermittleTerminierungsStichtag,
	mitUhrzeitVorlaeufig
} from '$lib/server/spielplanTermine';
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

	const heute = heuteDatum();

	const [naechsteSpieleRaw, stichtag] = await Promise.all([
		db.query.spiele.findMany({
			// Wie der Tab "Kommende": ab heute (Berlin) und noch ohne Endergebnis.
			// Die Tore sind per CHECK beide gesetzt oder beide null.
			where: and(gte(spiele.datum, heute), isNull(spiele.toreHeimteam)),
			// Nach Datum, dann Anpfiff; Postgres sortiert NULL bei ASC zuletzt (ohne Uhrzeit hinten).
			orderBy: [asc(spiele.datum), asc(spiele.uhrzeit)],
			limit: 3
		}),
		ermittleTerminierungsStichtag()
	]);

	// Offene Freigaben nur zu offenen Spielen (gemeinsame Regel aus spielStatus.ts);
	// darauf bauen freeCount, "meine offenen Freigaben" und "Aktuell freie Karten" auf.
	const offeneFreigaben = (
		await db.query.freigaben.findMany({
			where: eq(freigaben.status, 'offen'),
			with: {
				dauerkarte: { with: { besitzer: true } },
				spiel: true,
				bewerbungen: { with: { mitglied: true } }
			}
		})
	).filter((f) => istSpielOffen(f.spiel, heute));

	const naechsteSpiele = mitUhrzeitVorlaeufig(naechsteSpieleRaw, stichtag).map((spiel) => ({
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
