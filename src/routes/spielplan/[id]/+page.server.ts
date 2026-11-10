import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	spiele as spieleTable,
	dauerkarten,
	freigaben,
	bewerbungen,
	interesse,
	mitglieder
} from '$lib/server/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { toggleFreigabe, vergebenAn, vergebenAnMitInteresse } from '$lib/server/freigaben';
import { interesseAnmelden, interesseZurueckziehen } from '$lib/server/interesse';
import { bewerbungZurueckziehen } from '$lib/server/bewerbungen';
import { istUniqueViolation } from '$lib/server/db/errors';
import { hatAdminRolle } from '$lib/server/rollen';
import { alsAktionsFehler } from '$lib/server/aktionen';
import {
	benachrichtigenOhneFehler,
	spielBezeichnung,
	spielLink
} from '$lib/server/benachrichtigungen';
import {
	ermittleTerminierungsStichtag,
	istUhrzeitVorlaeufig
} from '$lib/server/spielplanTermine';
import { istSpielOffen, spielOffenBedingung, wennGesperrtFehler } from '$lib/server/spielStatus';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [spielRoh, stichtag] = await Promise.all([
		db.query.spiele.findFirst({
			where: eq(spieleTable.id, params.id)
		}),
		ermittleTerminierungsStichtag()
	]);

	if (!spielRoh) error(404, 'Spiel nicht gefunden');

	const spiel = { ...spielRoh, uhrzeitVorlaeufig: istUhrzeitVorlaeufig(spielRoh, stichtag) };
	// Gesperrt (vergangen oder mit Ergebnis) → nur noch Zurückziehen anbieten.
	// Reine UI-Steuerung; die Actions prüfen das selbst (spielStatus.ts).
	const spielOffen = istSpielOffen(spielRoh);

	const { user } = await locals.safeGetSession();
	const istAdmin = user ? await hatAdminRolle(user.id) : false;

	// Hat der eingeloggte Nutzer für dieses Spiel bereits Interesse angemeldet?
	// Einfache Existenzabfrage über (mitglied_id, spiel_id).
	const hatInteresseAngemeldet = user
		? (await db.query.interesse.findFirst({
				where: and(eq(interesse.mitgliedId, user.id), eq(interesse.spielId, spiel.id))
			})) != null
		: false;

	// Interesse-Liste für dieses Spiel – als reine Namensliste für alle Mitglieder sichtbar.
	const interesseRaw = await db.query.interesse.findMany({
		where: eq(interesse.spielId, spiel.id),
		with: { mitglied: true },
		orderBy: (i, { asc }) => asc(i.erstelltAm)
	});
	// Ohne eigene Dauerkarte gibt es nie einen Vergeben-Button (kannVergeben: false).
	const interesseListe = interesseRaw.map((i) => ({
		mitgliedId: i.mitgliedId,
		name: i.mitglied.name,
		kannVergeben: false
	}));

	// Alle Freigaben für dieses Spiel – für jedes eingeloggte Mitglied sichtbar,
	// ohne weitere Rollen-Einschränkung. Ausnahme: zurückgezogene Freigaben
	// sieht nur der Admin.
	const freigabenRaw = await db.query.freigaben.findMany({
		where: istAdmin
			? eq(freigaben.spielId, spiel.id)
			: and(eq(freigaben.spielId, spiel.id), ne(freigaben.status, 'zurueckgezogen')),
		with: {
			dauerkarte: { with: { besitzer: true } },
			bewerbungen: {
				with: { mitglied: true },
				orderBy: (b, { asc }) => asc(b.erstelltAm)
			}
		}
	});

	const freigabenFuerSpiel = freigabenRaw.map((f) => {
		const angenommene = f.bewerbungen.find((b) => b.status === 'angenommen');
		return {
			id: f.id,
			status: f.status,
			besitzerName: f.dauerkarte.besitzer.name,
			kartenBezeichnung: f.dauerkarte.bezeichnung,
			empfaengerName: f.status === 'vergeben' ? (angenommene?.mitglied.name ?? null) : null,
			// Ist der eingeloggte Nutzer selbst der Besitzer dieser Freigabe?
			istBesitzer: user ? f.dauerkarte.besitzerId === user.id : false,
			// Hat der eingeloggte Nutzer sich bereits auf diese Freigabe beworben?
			hatSelbstBeworben: user ? f.bewerbungen.some((b) => b.mitgliedId === user.id) : false,
			// Vollständige Bewerberliste – für alle Mitglieder sichtbar.
			bewerberListe: f.bewerbungen.map((b) => ({
				id: b.id,
				mitgliedId: b.mitgliedId,
				name: b.mitglied.name,
				status: b.status
			}))
		};
	});

	// Eigene Freigabe (offen/vergeben) für dieses Spiel → kein Interesse anmelden.
	// Abgeleitet aus den bereits geladenen Freigaben, deckt alle eigenen Karten ab.
	const interesseGesperrt = freigabenFuerSpiel.some(
		(f) => f.istBesitzer && (f.status === 'offen' || f.status === 'vergeben')
	);

	if (!user) {
		return {
			spiel,
			spielOffen,
			hasDauerkarte: false as const,
			freigabe: null,
			freigabenFuerSpiel,
			hatInteresseAngemeldet,
			interesseListe,
			interesseGesperrt,
			eigeneDauerkarteId: null
		};
	}

	const eigenesDauerkarte = await db.query.dauerkarten.findFirst({
		where: eq(dauerkarten.besitzerId, user.id)
	});

	if (!eigenesDauerkarte) {
		return {
			spiel,
			spielOffen,
			hasDauerkarte: false as const,
			freigabe: null,
			freigabenFuerSpiel,
			hatInteresseAngemeldet,
			interesseListe,
			interesseGesperrt,
			eigeneDauerkarteId: null
		};
	}

	const freigabe =
		(await db.query.freigaben.findFirst({
			where: and(eq(freigaben.dauerkarteId, eigenesDauerkarte.id), eq(freigaben.spielId, spiel.id)),
			with: {
				bewerbungen: { with: { mitglied: true } },
				vergebenAnMitglied: true
			}
		})) ?? null;

	// Vergeben aus der Interesse-Liste nur bei offenem Spiel und solange die eigene
	// Freigabe fehlt oder 'offen' ist, und nur für Personen ohne offene Bewerbung ('angefragt') darauf –
	// die haben ihren Vergeben-Button bereits in der Freigaben-Liste.
	// Reine UI-Logik; die Actions prüfen die Berechtigung selbst.
	const freigabeErlaubtVergabe = spielOffen && (!freigabe || freigabe.status === 'offen');
	const mitOffenerBewerbung = new Set(
		freigabe?.status === 'offen'
			? freigabe.bewerbungen.filter((b) => b.status === 'angefragt').map((b) => b.mitgliedId)
			: []
	);

	return {
		spiel,
		spielOffen,
		hasDauerkarte: true as const,
		freigabe,
		freigabenFuerSpiel,
		hatInteresseAngemeldet,
		interesseListe: interesseListe.map((person) => ({
			...person,
			kannVergeben: freigabeErlaubtVergabe && !mitOffenerBewerbung.has(person.mitgliedId)
		})),
		interesseGesperrt,
		eigeneDauerkarteId: eigenesDauerkarte.id
	};
};

export const actions: Actions = {
	toggleFreigabe: async ({ params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');
		try {
			await toggleFreigabe(user.id, params.id);
		} catch (e) {
			// z. B. 409 "Dieses Spiel hat bereits stattgefunden."
			return alsAktionsFehler(e);
		}
	},

	vergeben: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const freigabeId = String(form.get('freigabeId') ?? '');
		const bewerbungId = String(form.get('bewerbungId') ?? '');
		if (!freigabeId || !bewerbungId) error(400, 'Fehlende Daten');

		try {
			// bewerbungId -> mitgliedId auflösen; die Bewerbung muss zur angegebenen
			// Freigabe gehören.
			const bewerbung = await db.query.bewerbungen.findFirst({
				where: and(eq(bewerbungen.id, bewerbungId), eq(bewerbungen.freigabeId, freigabeId))
			});
			if (!bewerbung) error(404, 'Diese Bewerbung existiert nicht mehr.');

			// Gemeinsame Vergabe-Logik (auch von /karte genutzt): prüft serverseitig
			// den Dauerkarten-Besitzer und nutzt bedingte WHERE-Klauseln als
			// Race-Condition-Schutz (kein Read-then-Write).
			await vergebenAn(user.id, freigabeId, bewerbung.mitgliedId);
		} catch (e) {
			return alsAktionsFehler(e);
		}
	},

	vergebenAusInteresse: async ({ params, request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const dauerkarteId = String(form.get('dauerkarteId') ?? '');
		const mitgliedId = String(form.get('mitgliedId') ?? '');
		if (!dauerkarteId || !mitgliedId) error(400, 'Fehlende Daten');

		// Dritter Einstiegspunkt zur Vergabe – legt Freigabe/Bewerbung bei Bedarf
		// an, gesamte Autorisierung + Race-Schutz in vergebenAnMitInteresse.
		try {
			await vergebenAnMitInteresse(user.id, dauerkarteId, params.id, mitgliedId);
		} catch (e) {
			return alsAktionsFehler(e);
		}
	},

	interesseAnmelden: async ({ params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');
		try {
			await interesseAnmelden(user.id, params.id);
		} catch (e) {
			return alsAktionsFehler(e);
		}
	},

	interesseZurueckziehen: async ({ params, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');
		await interesseZurueckziehen(user.id, params.id);
	},

	bewerben: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const freigabeId = String(form.get('freigabeId') ?? '');
		if (!freigabeId) error(400, 'Fehlende Freigabe-ID');

		// Autorisierung: auf eine eigene Freigabe darf man sich nicht bewerben.
		const zielFreigabe = await db.query.freigaben.findFirst({
			where: eq(freigaben.id, freigabeId),
			with: { dauerkarte: true, spiel: true }
		});
		if (!zielFreigabe) error(404, 'Freigabe nicht gefunden');
		if (zielFreigabe.dauerkarte.besitzerId === user.id) {
			error(403, 'Auf die eigene Freigabe kann man sich nicht bewerben');
		}

		// INSERT nur, wenn die Freigabe aktuell 'offen' ist und das Spiel noch
		// nicht stattgefunden hat – als bedingter INSERT ... SELECT ... WHERE, ohne
		// separates Read-then-Write. Doppelte
		// Bewerbungen desselben Mitglieds fängt der Unique Constraint
		// (freigabe_id, mitglied_id) ab (analog zum interesse-Pattern).
		// `returning id` zeigt, ob wirklich eine Zeile angelegt wurde (postgres-js
		// liefert die Ergebnis-Zeilen als Array).
		let angelegt = false;
		try {
			const zeilen = await db.execute(sql`
				insert into ${bewerbungen} ("freigabe_id", "mitglied_id", "status")
				select ${freigabeId}::uuid, ${user.id}::uuid, 'angefragt'::bewerbung_status
				where exists (
					select 1 from ${freigaben}
					where ${freigaben.id} = ${freigabeId}::uuid and ${freigaben.status} = 'offen'
						and ${spielOffenBedingung(freigaben.spielId)}
				)
				returning id
			`);
			angelegt = zeilen.length > 0;
		} catch (e) {
			if (!istUniqueViolation(e)) throw e;
		}

		// Nicht angelegt: Liegt es an der Sperre, mit Meldung zurück; sonst (Freigabe
		// nicht mehr offen, Doppelklick) bleibt es wie bisher ein stiller No-Op.
		if (!angelegt) {
			try {
				await wennGesperrtFehler(zielFreigabe.spielId);
			} catch (e) {
				return alsAktionsFehler(e);
			}
		}

		// Nur bei neu angelegter Anfrage den Besitzer benachrichtigen.
		if (angelegt) {
			await benachrichtigenOhneFehler(async () => {
				const bewerber = await db.query.mitglieder.findFirst({
					columns: { name: true },
					where: eq(mitglieder.id, user.id)
				});
				if (!bewerber) return null;
				const bezeichnung = spielBezeichnung(zielFreigabe.spiel);
				return {
					empfaengerIds: [zielFreigabe.dauerkarte.besitzerId],
					typ: 'neue_anfrage' as const,
					titel: 'Neue Anfrage',
					text: `${bewerber.name} fragt deine Karte für ${bezeichnung} an.`,
					link: spielLink(zielFreigabe.spielId),
					ausloeserId: user.id
				};
			});
		}
	},

	bewerbungZurueckziehen: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) error(403, 'Nicht angemeldet');

		const form = await request.formData();
		const freigabeId = String(form.get('freigabeId') ?? '');
		if (!freigabeId) error(400, 'Fehlende Freigabe-ID');

		await bewerbungZurueckziehen(user.id, freigabeId);
	}
};
