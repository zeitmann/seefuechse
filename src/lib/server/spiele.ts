import { error } from '@sveltejs/kit';
import { and, eq, ne, notExists } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { freigaben, heimAuswaertsEnum, interesse, spiele } from '$lib/server/db/schema';

/** Erlaubte Wettbewerbe – exakt die Werte, nach denen /spielplan filtert. */
export const WETTBEWERBE = ['Bundesliga', 'DFB-Pokal', 'Europa League'] as const;
export type Wettbewerb = (typeof WETTBEWERBE)[number];

/** Enum-Werte aus dem Schema ('heim', 'auswaerts'). */
export const HEIM_AUSWAERTS_WERTE = heimAuswaertsEnum.enumValues;
export type HeimAuswaerts = (typeof HEIM_AUSWAERTS_WERTE)[number];

/** Vom Formular bearbeitbare Felder. openligadb_id ist bewusst nicht enthalten. */
export type SpielDaten = {
	datum: string;
	gegner: string;
	wettbewerb: Wettbewerb;
	heimAuswaerts: HeimAuswaerts;
};

export type PruefErgebnis = { ok: true; daten: SpielDaten } | { ok: false; fehler: string };

const NICHT_MEHR_VORHANDEN = 'Dieses Spiel existiert nicht mehr.';
const UUID_MUSTER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
	const gegner = String(form.get('gegner') ?? '').trim();
	const wettbewerb = String(form.get('wettbewerb') ?? '');
	const heimAuswaerts = String(form.get('heimAuswaerts') ?? '');

	if (!istGueltigesDatum(datum)) {
		return { ok: false, fehler: 'Bitte ein gültiges Datum angeben.' };
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
	return { ok: true, daten: { datum, gegner, wettbewerb, heimAuswaerts } };
}

/**
 * Gibt es schon ein Spiel mit gleichem Datum, Gegner und Wettbewerb? `ausserId`
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
 */
export async function spielAendern(spielId: string, daten: SpielDaten): Promise<void> {
	if (!UUID_MUSTER.test(spielId)) error(404, NICHT_MEHR_VORHANDEN);
	if (await existiertBereits(daten, spielId)) error(409, 'Dieses Spiel existiert bereits.');

	const geaendert = await db
		.update(spiele)
		.set({
			datum: daten.datum,
			gegner: daten.gegner,
			wettbewerb: daten.wettbewerb,
			heimAuswaerts: daten.heimAuswaerts
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
