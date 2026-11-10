import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { fuehreSyncMitProtokollAus } from '$lib/server/spielplanSync';
import type { RequestHandler } from './$types';

/**
 * Zeitkonstanter Vergleich zweier Strings: Beide werden per SHA-256 auf gleiche
 * Länge (32 Byte) gebracht und dann vollständig ohne frühen Abbruch verglichen –
 * wie node:crypto timingSafeEqual. Web Crypto statt node:crypto, weil das Projekt
 * keine Node-Typen (@types/node) enthält.
 */
async function sindGleich(a: string, b: string): Promise<boolean> {
	const kodierer = new TextEncoder();
	const [hashA, hashB] = await Promise.all([
		crypto.subtle.digest('SHA-256', kodierer.encode(a)),
		crypto.subtle.digest('SHA-256', kodierer.encode(b))
	]);
	const bytesA = new Uint8Array(hashA);
	const bytesB = new Uint8Array(hashB);
	let unterschied = 0;
	for (let i = 0; i < bytesA.length; i++) unterschied |= bytesA[i] ^ bytesB[i];
	return unterschied === 0;
}

/**
 * Wird täglich von der Netlify Scheduled Function aufgerufen. Statt einer
 * Anmeldung schützt ein Bearer-Token (CRON_SECRET); der Login-Guard in
 * hooks.server.ts nimmt genau diesen Pfad aus. Nur POST (andere Methoden: 405).
 */
export const POST: RequestHandler = async ({ request }) => {
	const geheimnis = env.CRON_SECRET;
	// Fail closed: ohne konfiguriertes Secret ist der Endpoint gesperrt.
	if (!geheimnis) {
		return json({ fehler: 'Cron ist nicht konfiguriert.' }, { status: 503 });
	}

	const kopf = request.headers.get('authorization') ?? '';
	if (!(await sindGleich(kopf, `Bearer ${geheimnis}`))) {
		return json({ fehler: 'Nicht autorisiert.' }, { status: 401 });
	}

	const ergebnis = await fuehreSyncMitProtokollAus('cron');
	return json(ergebnis);
};
