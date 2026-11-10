// src/lib/spielAnzeige.ts
//
// Gemeinsame Anzeige-Helfer für Spiele (Kachel, Detailseite, Spielplan-Tabs).
// Datumsstrings 'JJJJ-MM-TT' werden per Split gelesen und in UTC formatiert –
// new Date('JJJJ-MM-TT') würde als UTC-Mitternacht geparst und in Zeitzonen
// westlich von UTC lokal als Vortag angezeigt.

const EIGENES_TEAM = 'SC Freiburg';

const MONATE_KURZ = [
	'Jan',
	'Feb',
	'Mär',
	'Apr',
	'Mai',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Okt',
	'Nov',
	'Dez'
];

const kurzFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: 'UTC',
	weekday: 'short',
	day: 'numeric',
	month: 'short'
});

const langFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: 'UTC',
	weekday: 'long',
	day: '2-digit',
	month: 'long',
	year: 'numeric'
});

// en-CA liefert 'JJJJ-MM-TT'
const berlinTagFormat = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Europe/Berlin',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

/** Minimal nötige Felder eines Spiels für Ergebnis und Teamnamen. */
export type SpielFuerAnzeige = {
	gegner: string;
	heimAuswaerts: 'heim' | 'auswaerts';
	toreHeimteam: number | null | undefined;
	toreGastteam: number | null | undefined;
};

/** 'JJJJ-MM-TT' als Date um 00:00 UTC (nur mit timeZone 'UTC' formatieren). */
function alsUtcDatum(datum: string): Date {
	const [jahr, monat, tag] = datum.split('-').map(Number);
	return new Date(Date.UTC(jahr, monat - 1, tag));
}

/**
 * Zerlegt die Runde für den großen Block der Kachel: '3. Spieltag' →
 * { gross: '3', klein: 'Spieltag' }; 'Achtelfinale' → { gross: 'Achtelfinale',
 * klein: null } (Text, wird kleiner gesetzt); keine Runde → null.
 */
export function rundeAnzeige(
	runde: string | null | undefined
): { gross: string; klein: string | null } | null {
	const text = runde?.trim();
	if (!text) return null;
	const treffer = /^(\d+)\.\s*(.+)$/.exec(text);
	if (treffer) return { gross: treffer[1], klein: treffer[2] };
	return { gross: text, klein: null };
}

/** 'Sa., 21. Nov.' */
export function datumKurz(datum: string): string {
	return kurzFormat.format(alsUtcDatum(datum));
}

/** 'Samstag, 21. November 2026' */
export function datumLang(datum: string): string {
	return langFormat.format(alsUtcDatum(datum));
}

/** Tag und Monat für den großen Datumsblock: { tag: '21', monat: 'Nov' }. */
export function datumGross(datum: string): { tag: string; monat: string } {
	const [, monat, tag] = datum.split('-');
	return { tag: tag.padStart(2, '0'), monat: MONATE_KURZ[Number(monat) - 1] ?? '' };
}

/** Heutiges Datum in Europe/Berlin als 'JJJJ-MM-TT' (Server und Browser gleich). */
export function heuteDatum(): string {
	return berlinTagFormat.format(new Date());
}

/** true, wenn ein Endergebnis vorliegt (0 Tore ist ein gültiger Wert). */
export function hatErgebnis(
	spiel: Pick<SpielFuerAnzeige, 'toreHeimteam' | 'toreGastteam'>
): boolean {
	return spiel.toreHeimteam != null && spiel.toreGastteam != null;
}

/** Name des Heimteams im Stadion (Tore stehen in dieser Reihenfolge). */
export function heimteamName(spiel: Pick<SpielFuerAnzeige, 'gegner' | 'heimAuswaerts'>): string {
	return spiel.heimAuswaerts === 'heim' ? EIGENES_TEAM : spiel.gegner;
}

/** Name des Gastteams im Stadion. */
export function gastteamName(spiel: Pick<SpielFuerAnzeige, 'gegner' | 'heimAuswaerts'>): string {
	return spiel.heimAuswaerts === 'heim' ? spiel.gegner : EIGENES_TEAM;
}
