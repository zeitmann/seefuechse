// src/lib/zeit.ts
//
// Relative Zeitangaben auf Deutsch, z. B. für Benachrichtigungen. Kalendertage
// werden fest in Europe/Berlin berechnet, damit Server-Rendering (UTC) und
// Browser dasselbe Ergebnis liefern.

const ZEITZONE = 'Europe/Berlin';

const tagFormat = new Intl.DateTimeFormat('en-CA', {
	timeZone: ZEITZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

const kurzDatumFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: ZEITZONE,
	day: '2-digit',
	month: '2-digit'
});

/** Kalendertag in Berlin als 'JJJJ-MM-TT'. */
function berlinerTag(datum: Date): string {
	return tagFormat.format(datum);
}

/** Kalendertag vor dem Berliner Tag von `datum`, als 'JJJJ-MM-TT'. */
function berlinerVortag(datum: Date): string {
	const [jahr, monat, tag] = berlinerTag(datum).split('-').map(Number);
	// Rechnen in UTC umgeht Sommer-/Winterzeit-Sprünge.
	return new Date(Date.UTC(jahr, monat - 1, tag - 1)).toISOString().slice(0, 10);
}

/**
 * 'gerade eben', 'vor 5 Min.', 'vor 2 Std.' (unter 24 Std.), 'gestern' (Vortag in
 * Berlin), sonst 'TT.MM.'.
 */
export function relativeZeit(datum: Date | string, jetzt: Date = new Date()): string {
	const zeitpunkt = typeof datum === 'string' ? new Date(datum) : datum;
	const minuten = Math.floor((jetzt.getTime() - zeitpunkt.getTime()) / 60_000);

	if (minuten < 1) return 'gerade eben';
	if (minuten < 60) return `vor ${minuten} Min.`;
	if (minuten < 24 * 60) return `vor ${Math.floor(minuten / 60)} Std.`;
	if (berlinerTag(zeitpunkt) === berlinerVortag(jetzt)) return 'gestern';

	// de-DE liefert '05.11.'
	return kurzDatumFormat.format(zeitpunkt);
}
