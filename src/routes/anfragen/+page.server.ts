import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { dauerkarten, freigaben, bewerbungen, interesse } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { vergebenAn } from '$lib/server/freigaben';
import { interesseZurueckziehen } from '$lib/server/interesse';
import { bewerbungZurueckziehen } from '$lib/server/bewerbungen';
import { alsAktionsFehler } from '$lib/server/aktionen';
import type { PageServerLoad, Actions } from './$types';

type MeinInteresse = {
	spielId: string;
	gegner: string;
	datum: string;
	wettbewerb: string;
};

type MeineBewerbung = {
	id: string;
	freigabeId: string;
	status: 'angefragt' | 'angenommen' | 'abgelehnt';
	gegner: string;
	datum: string;
	wettbewerb: string;
	besitzerName: string;
};

type EigeneOffeneFreigabe = {
	id: string;
	gegner: string;
	datum: string;
	wettbewerb: string;
	kartenBezeichnung: string;
	bewerberListe: {
		id: string;
		mitgliedId: string;
		name: string;
		status: 'angefragt' | 'angenommen' | 'abgelehnt';
	}[];
};

const leer = {
	meineInteressen: [] as MeinInteresse[],
	meineBewerbungen: [] as MeineBewerbung[],
	eigeneOffeneFreigaben: [] as EigeneOffeneFreigabe[]
};

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return leer;

	const heute = new Date().toISOString().slice(0, 10);

	// 1. Eigene Interesse-Anmeldungen – nur kommende Spiele, nach Datum aufsteigend.
	const meineInteressenRaw = await db.query.interesse.findMany({
		where: eq(interesse.mitgliedId, user.id),
		with: { spiel: true }
	});
	const meineInteressen: MeinInteresse[] = meineInteressenRaw
		.filter((i) => i.spiel.datum >= heute)
		.sort((a, b) => a.spiel.datum.localeCompare(b.spiel.datum))
		.map((i) => ({
			spielId: i.spielId,
			gegner: i.spiel.gegner,
			datum: i.spiel.datum,
			wettbewerb: i.spiel.wettbewerb
		}));

	// 2. Eigene Bewerbungen – mit Spiel- und Kartenbesitzer-Infos, nach Datum.
	const meineBewerbungenRaw = await db.query.bewerbungen.findMany({
		where: eq(bewerbungen.mitgliedId, user.id),
		with: {
			freigabe: {
				with: {
					spiel: true,
					dauerkarte: { with: { besitzer: true } }
				}
			}
		}
	});
	const meineBewerbungen: MeineBewerbung[] = meineBewerbungenRaw
		.sort((a, b) => a.freigabe.spiel.datum.localeCompare(b.freigabe.spiel.datum))
		.map((b) => ({
			id: b.id,
			freigabeId: b.freigabeId,
			status: b.status,
			gegner: b.freigabe.spiel.gegner,
			datum: b.freigabe.spiel.datum,
			wettbewerb: b.freigabe.spiel.wettbewerb,
			besitzerName: b.freigabe.dauerkarte.besitzer.name
		}));

	// 3. Eigene offene Freigaben mit Bewerberliste – nur wenn der Nutzer
	//    mindestens eine Dauerkarte besitzt.
	const eigeneDauerkarten = await db.query.dauerkarten.findMany({
		where: eq(dauerkarten.besitzerId, user.id)
	});
	const eigeneDauerkartenIds = eigeneDauerkarten.map((d) => d.id);

	let eigeneOffeneFreigaben: EigeneOffeneFreigabe[] = [];
	if (eigeneDauerkartenIds.length > 0) {
		const raw = await db.query.freigaben.findMany({
			where: and(
				inArray(freigaben.dauerkarteId, eigeneDauerkartenIds),
				eq(freigaben.status, 'offen')
			),
			with: {
				spiel: true,
				dauerkarte: true,
				bewerbungen: {
					with: { mitglied: true },
					orderBy: (b, { asc }) => asc(b.erstelltAm)
				}
			}
		});
		eigeneOffeneFreigaben = raw
			.sort((a, b) => a.spiel.datum.localeCompare(b.spiel.datum))
			.map((f) => ({
				id: f.id,
				gegner: f.spiel.gegner,
				datum: f.spiel.datum,
				wettbewerb: f.spiel.wettbewerb,
				kartenBezeichnung: f.dauerkarte.bezeichnung,
				bewerberListe: f.bewerbungen.map((b) => ({
					id: b.id,
					mitgliedId: b.mitgliedId,
					name: b.mitglied.name,
					status: b.status
				}))
			}));
	}

	return { meineInteressen, meineBewerbungen, eigeneOffeneFreigaben };
};

export const actions: Actions = {
	interesseZurueckziehen: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const spielId = String(form.get('spielId') ?? '');
		if (!spielId) error(400, 'Fehlende Spiel-ID');

		await interesseZurueckziehen(user.id, spielId);
	},

	bewerbungZurueckziehen: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const freigabeId = String(form.get('freigabeId') ?? '');
		if (!freigabeId) error(400, 'Fehlende Freigabe-ID');

		await bewerbungZurueckziehen(user.id, freigabeId);
	},

	vergeben: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const freigabeId = String(form.get('freigabeId') ?? '');
		const bewerbungId = String(form.get('bewerbungId') ?? '');
		if (!freigabeId || !bewerbungId) error(400, 'Fehlende Daten');

		// bewerbungId -> mitgliedId auflösen; die Bewerbung muss zur angegebenen
		// Freigabe gehören. Danach dieselbe gemeinsame Vergabe-Logik wie auf
		// /spielplan/[id] und /karte (Autorisierung + Race-Schutz in vergebenAn).
		try {
			const bewerbung = await db.query.bewerbungen.findFirst({
				where: and(eq(bewerbungen.id, bewerbungId), eq(bewerbungen.freigabeId, freigabeId))
			});
			if (!bewerbung) error(404, 'Diese Bewerbung existiert nicht mehr.');

			await vergebenAn(user.id, freigabeId, bewerbung.mitgliedId);
		} catch (e) {
			return alsAktionsFehler(e);
		}
	}
};
