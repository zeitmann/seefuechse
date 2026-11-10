// netlify/functions/spielplan-sync-taeglich.mts
//
// Netlify Scheduled Function: stößt den Spielplan-Sync der App an (04:00 UTC und
// stündlich 12–23 UTC). Der Dateiname "taeglich" ist historisch (früher ein Lauf
// pro Tag); er bleibt, weil er den Funktionsnamen bei Netlify festlegt.
// Bewusst ohne Imports aus src/ – die eigentliche Logik läuft im SvelteKit-
// Endpoint /api/cron/spielplan-sync, abgesichert per CRON_SECRET.

export default async () => {
	const basis = process.env.URL || process.env.SITE_BASE_URL;
	const geheimnis = process.env.CRON_SECRET;

	if (!basis || !geheimnis) {
		console.error(
			'Spielplan-Sync: Abbruch – URL bzw. SITE_BASE_URL oder CRON_SECRET ist nicht gesetzt.'
		);
		return;
	}

	try {
		const antwort = await fetch(`${basis}/api/cron/spielplan-sync`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${geheimnis}` },
			// Limit der Function sind 30 s
			signal: AbortSignal.timeout(25000)
		});

		const text = await antwort.text();
		let kurzergebnis = text.slice(0, 300);
		try {
			const e = JSON.parse(text);
			kurzergebnis = JSON.stringify({
				erfolgreich: e.erfolgreich,
				neu: e.neu,
				geaendert: e.geaendert,
				unveraendert: e.unveraendert,
				uebersprungen: e.uebersprungenManuell,
				hinweise: e.hinweise,
				fehler: e.fehler
			});
		} catch {
			// Keine JSON-Antwort – gekürzten Text ausgeben
		}
		console.log(`Spielplan-Sync: HTTP ${antwort.status} ${kurzergebnis}`);
	} catch (e) {
		console.error('Spielplan-Sync: Aufruf fehlgeschlagen –', e instanceof Error ? e.message : e);
	}
};

// 04:00 UTC (nachts, Spielplan/Anstoßzeiten) plus stündlich 12:00–23:00 UTC, damit
// Ergebnisse am Spieltag zeitnah erscheinen. Deutsche Zeit: 05:00 und 13:00–00:00
// Uhr (Winter) bzw. 06:00 und 14:00–01:00 Uhr (Sommer). 13 Läufe pro Tag.
export const config = { schedule: '0 4,12-23 * * *' };
