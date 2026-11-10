import { error } from '@sveltejs/kit';
import { and, eq, ne, notExists, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { freigaben, heimAuswaertsEnum, interesse, spiele } from '$lib/server/db/schema';
import { findeAehnlichenVerein, leerzeichenBereinigen } from '$lib/server/vereinsnamen';

/** Erlaubte Wettbewerbe – exakt die Werte, nach denen /spielplan filtert. */
export const WETTBEWERBE = [
	'Bundesliga',
	'DFB-Pokal',
	'Europa League',
	'Conference League',
	'Testspiel'
] as const;
export type Wettbewerb = (typeof WETTBEWERBE)[number];

/** Enum-Werte aus dem Schema ('heim', 'auswaerts'). */
export const HEIM_AUSWAERTS_WERTE = heimAuswaertsEnum.enumValues;
export type HeimAuswaerts = (typeof HEIM_AUSWAERTS_WERTE)[number];

/** Vom Formular bearbeitbare Felder. openligadb_id ist bewusst nicht enthalten. */
export type SpielDaten = {
	datum: string;
	/** 'HH:MM' oder null (keine Anpfiffzeit bekannt) */
	uhrzeit: string | null;
	gegner: string;
	wettbewerb: Wettbewerb;
	heimAuswaerts: HeimAuswaerts;
};

export type PruefErgebnis = { ok: true; daten: SpielDaten } | { ok: false; fehler: string };

const NICHT_MEHR_VORHANDEN = 'Dieses Spiel existiert nicht mehr.';
export const UUID_MUSTER =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 'JJJJ-MM-TT' und ein real existierender Kalendertag (kein 31.02.). */
function istGueltigesDatum(wert: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
	const [jahr, monat, tag] = wert.split('-').map(Number);
	const datum = new Date(Date.UTC(jahr, monat - 1, tag));
	return (
		datum.getUTCFullYear() === jahr &&
		datum.getUTCMonth() === monat - 1 &&
		datum.getUTCDate() === tag
	);
}

/** 'HH:MM' mit Stunde 0–23 und Minute 0–59. */
function istGueltigeUhrzeit(wert: string): boolean {
	return /^([01]\d|2[0-3]):[0-5]\d$/.test(wert);
}

function istWettbewerb(wert: string): wert is Wettbewerb {
	return (WETTBEWERBE as readonly string[]).includes(wert);
}

function istHeimAuswaerts(wert: string): wert is HeimAuswaerts {
	return (HEIM_AUSWAERTS_WERTE as readonly string[]).includes(wert);
}

/**
 * Liest und validiert die Formularfelder datum, gegner, wettbewerb und heimAuswaerts.
 * Liefert bei Fehlern eine verständliche deutsche Meldung für fail(400, …).
 */
export function spielEingabePruefen(form: FormData): PruefErgebnis {
	const datum = String(form.get('datum') ?? '').trim();
	const uhrzeit = String(form.get('uhrzeit') ?? '').trim();
	const gegner = leerzeichenBereinigen(String(form.get('gegner') ?? ''));
	const wettbewerb = String(form.get('wettbewerb') ?? '');
	const heimAuswaerts = String(form.get('heimAuswaerts') ?? '');

	if (!istGueltigesDatum(datum)) {
		return { ok: false, fehler: 'Bitte ein gültiges Datum angeben.' };
	}
	// Uhrzeit ist optional: leer → null
	if (uhrzeit && !istGueltigeUhrzeit(uhrzeit)) {
		return { ok: false, fehler: 'Bitte eine gültige Uhrzeit angeben.' };
	}
	if (gegner.length < 2 || gegner.length > 60) {
		return { ok: false, fehler: 'Der Gegner muss 2 bis 60 Zeichen lang sein.' };
	}
	if (!istWettbewerb(wettbewerb)) {
		return { ok: false, fehler: 'Bitte einen gültigen Wettbewerb auswählen.' };
	}
	if (!istHeimAuswaerts(heimAuswaerts)) {
		return { ok: false, fehler: 'Bitte Heim oder Auswärts auswählen.' };
	}
	return {
		ok: true,
		daten: { datum, uhrzeit: uhrzeit || null, gegner, wettbewerb, heimAuswaerts }
	};
}

/** Alle bisher verwendeten Gegnernamen (kanonische Schreibweisen), alphabetisch. */
export async function vorhandeneGegner(): Promise<string[]> {
	const zeilen = await db
		.selectDistinct({ gegner: spiele.gegner })
		.from(spiele)
		.orderBy(spiele.gegner);
	return zeilen.map((z) => z.gegner);
}

export type NamensErgebnis =
	| { ok: true; gegner: string }
	| { ok: false; vorschlag: { eingegeben: string; vorhanden: string } };

/**
 * Vereinheitlicht den eingegebenen Gegnernamen gegen die vorhandenen Namen.
 * Exakte Treffer (nach Normalisierung) werden automatisch übernommen; bei
 * ähnlichen Treffern entscheidet der Verwalter über `namensEntscheidung`
 * ('vorhanden' | 'neu'), fehlt sie, kommt ein Vorschlag zur Rückfrage zurück.
 * Der vorgeschlagene Name wird immer serverseitig neu ermittelt.
 * Beim Ändern bleibt der Name des bearbeiteten Spiels bewusst in der Liste.
 */
export async function gegnerVereinheitlichen(
	eingegeben: string,
	namensEntscheidung: string
): Promise<NamensErgebnis> {
	const treffer = findeAehnlichenVerein(eingegeben, await vorhandeneGegner());

	if (treffer.art === 'exakt') return { ok: true, gegner: treffer.name };
	if (treffer.art === 'keiner') return { ok: true, gegner: eingegeben };

	if (namensEntscheidung === 'vorhanden') return { ok: true, gegner: treffer.name };
	if (namensEntscheidung === 'neu') return { ok: true, gegner: eingegeben };
	return { ok: false, vorschlag: { eingegeben, vorhanden: treffer.name } };
}

/**
 * Gibt es schon ein Spiel mit gleichem Datum, Gegner und Wettbewerb (Uhrzeit
 * bewusst nicht berücksichtigt)? `ausserId`
 * nimmt beim Ändern das eigene Spiel aus.
 */
async function existiertBereits(daten: SpielDaten, ausserId?: string): Promise<boolean> {
	const treffer = await db
		.select({ id: spiele.id })
		.from(spiele)
		.where(
			and(
				eq(spiele.datum, daten.datum),
				eq(spiele.gegner, daten.gegner),
				eq(spiele.wettbewerb, daten.wettbewerb),
				ausserId ? ne(spiele.id, ausserId) : undefined
			)
		)
		.limit(1);
	return treffer.length > 0;
}

/** Legt ein Spiel an (openligadb_id = null). 409 bei Dubletten. */
export async function spielAnlegen(daten: SpielDaten): Promise<void> {
	if (await existiertBereits(daten)) error(409, 'Dieses Spiel existiert bereits.');

	await db.insert(spiele).values({ ...daten, openligadbId: null });
}

/**
 * Ändert die bearbeitbaren Felder eines Spiels. openligadb_id bleibt unangetastet;
 * Freigaben, Bewerbungen und Interesse hängen an der Spiel-ID und bleiben erhalten.
 * 404 bei unbekannter ID, 409 bei Dubletten.
 *
 * Synchronisierte Spiele (mit openligadb_id) werden bei einer tatsächlichen
 * Änderung im selben UPDATE als manuell überschrieben markiert, damit der
 * OpenLigaDB-Sync sie nicht zurücksetzt. Im SET sieht Postgres noch die alten
 * Werte, daher vergleicht der CASE-Ausdruck den bisherigen mit dem neuen Stand.
 * Ohne openligadb_id oder ohne Änderung bleibt das Flag wie es ist.
 */
export async function spielAendern(spielId: string, daten: SpielDaten): Promise<void> {
	if (!UUID_MUSTER.test(spielId)) error(404, NICHT_MEHR_VORHANDEN);
	if (await existiertBereits(daten, spielId)) error(409, 'Dieses Spiel existiert bereits.');

	const geaendert = await db
		.update(spiele)
		.set({
			datum: daten.datum,
			// Leeres Feld löscht eine vorhandene Uhrzeit (null).
			uhrzeit: daten.uhrzeit,
			gegner: daten.gegner,
			wettbewerb: daten.wettbewerb,
			heimAuswaerts: daten.heimAuswaerts,
			manuellUeberschrieben: sql`case
				when ${spiele.openligadbId} is not null
					and (${spiele.datum}, ${spiele.uhrzeit}, ${spiele.gegner}, ${spiele.wettbewerb},
						${spiele.heimAuswaerts})
					is distinct from
					(${daten.datum}::date, ${daten.uhrzeit}::time, ${daten.gegner}::text,
						${daten.wettbewerb}::text, ${daten.heimAuswaerts}::heim_auswaerts)
				then true
				else ${spiele.manuellUeberschrieben}
			end`
		})
		.where(eq(spiele.id, spielId))
		.returning({ id: spiele.id });

	if (geaendert.length === 0) error(404, NICHT_MEHR_VORHANDEN);
}

/**
 * Löscht ein Spiel nur, wenn es weder Freigaben noch Interesse hat – geprüft
 * in EINEM bedingten DELETE (kein Read-then-Write). Wichtig, weil freigaben und
 * interesse per `on delete cascade` am Spiel hängen: ein ungeschütztes DELETE
 * würde die Vergabe-Historie (inkl. Bewerbungen) mitlöschen.
 *
 * Kommt keine Zeile zurück, klärt eine Folgeabfrage den Grund: 404 (schon weg)
 * oder 409 (hat abhängige Daten).
 */
export async function spielLoeschen(spielId: string): Promise<void> {
	if (!UUID_MUSTER.test(spielId)) error(404, NICHT_MEHR_VORHANDEN);

	const geloescht = await db
		.delete(spiele)
		.where(
			and(
				eq(spiele.id, spielId),
				notExists(
					db
						.select({ id: freigaben.id })
						.from(freigaben)
						.where(eq(freigaben.spielId, spiele.id))
				),
				notExists(
					db
						.select({ id: interesse.id })
						.from(interesse)
						.where(eq(interesse.spielId, spiele.id))
				)
			)
		)
		.returning({ id: spiele.id });

	if (geloescht.length > 0) return;

	const vorhanden = await db.query.spiele.findFirst({
		columns: { id: true },
		where: eq(spiele.id, spielId)
	});
	if (!vorhanden) error(404, NICHT_MEHR_VORHANDEN);
	error(
		409,
		'Dieses Spiel hat bereits Freigaben, Anfragen oder Interesse und kann nicht gelöscht werden.'
	);
}
