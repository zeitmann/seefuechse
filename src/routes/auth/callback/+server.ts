import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

/**
 * Einstiegspunkt für Links aus Supabase-Auth-Mails (z. B. Passwort zurücksetzen).
 *
 * Unterstützt beide Varianten:
 * - PKCE (`?code=…`): Standard bei @supabase/ssr. Funktioniert nur im selben
 *   Browser, in dem die Mail angefordert wurde (Code-Verifier liegt im Cookie).
 * - token_hash (`?token_hash=…&type=recovery`): funktioniert geräteübergreifend,
 *   setzt aber ein angepasstes E-Mail-Template in Supabase voraus.
 *
 * Danach wird auf `next` weitergeleitet – aber nur, wenn das ein relativer Pfad
 * innerhalb der App ist (Schutz vor Open Redirect).
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const tokenHash = url.searchParams.get('token_hash');
	const typ = url.searchParams.get('type') as EmailOtpType | null;
	const ziel = sicheresZiel(url.searchParams.get('next'), url);

	let erfolgreich = false;

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		erfolgreich = !error;
	} else if (tokenHash && typ) {
		const { error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type: typ });
		erfolgreich = !error;
	}

	if (!erfolgreich) {
		redirect(303, '/passwort-vergessen?fehler=link-ungueltig');
	}

	redirect(303, ziel);
};

/** Akzeptiert nur relative Pfade derselben Origin, sonst Startseite. */
function sicheresZiel(next: string | null, url: URL): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
		return '/';
	}
	try {
		const ziel = new URL(next, url.origin);
		if (ziel.origin !== url.origin) return '/';
		return ziel.pathname + ziel.search + ziel.hash;
	} catch {
		return '/';
	}
}
