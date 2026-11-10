// src/lib/server/vereinsnamen.ts
//
// Abgleich von Gegnernamen gegen die bereits verwendeten Namen in `spiele`.
// Reine Funktionen ohne DB-Zugriff, damit sie isoliert prüfbar sind.

/** Zusätze ohne Unterscheidungskraft ('FC', 'e. V.', '1.' …). */
const IGNORIERTE_TOKENS = new Set([
	'fc',
	'sv',
	'vfl',
	'vfb',
	'tsg',
	'fsv',
	'sc',
	'tsv',
	'rb',
	'ev',
	'e',
	'v'
]);

/** Reine Zahlen: Zählzeichen ('1' aus '1.') und Jahreszahlen ('04', '1899'). */
const NUR_ZIFFERN = /^\d+$/;

/** Mehrfache Leerzeichen zu einem, außen getrimmt – so wird ein neuer Name gespeichert. */
export function leerzeichenBereinigen(name: string): string {
	return name.trim().replace(/\s+/g, ' ');
}

/**
 * Zerlegt einen Vereinsnamen in normalisierte Tokens: Kleinschreibung, ohne
 * Akzente/Umlaute (ä/ae → a, ß → ss), ohne Satzzeichen und ohne gängige Zusätze.
 * Bleibt nach dem Entfernen der Zusätze nichts übrig (z. B. 'SC'), werden die
 * Tokens unverändert zurückgegeben.
 */
export function normalisiereVereinsname(name: string): string[] {
	const text = name
		.toLowerCase()
		.replace(/ß/g, 'ss')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		// 'Muenchen' = 'München': ae/oe/ue wie a/o/u behandeln
		.replace(/ae/g, 'a')
		.replace(/oe/g, 'o')
		.replace(/ue/g, 'u')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

	const alle = [...new Set(text.split(' ').filter(Boolean))];
	const kern = alle.filter((t) => !IGNORIERTE_TOKENS.has(t) && !NUR_ZIFFERN.test(t));
	return kern.length > 0 ? kern : alle;
}

/** Levenshtein-Distanz (Einfügen, Löschen, Ersetzen kosten je 1). */
export function levenshtein(a: string, b: string): number {
	let vorher = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const aktuell = [i];
		for (let j = 1; j <= b.length; j++) {
			const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
			aktuell[j] = Math.min(vorher[j] + 1, aktuell[j - 1] + 1, vorher[j - 1] + kosten);
		}
		vorher = aktuell;
	}
	return vorher[b.length];
}

export type VereinsTreffer =
	| { art: 'exakt'; name: string }
	| { art: 'aehnlich'; name: string }
	| { art: 'keiner' };

function gleicheMengen(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((t) => b.includes(t));
}

/**
 * Gleicht `eingabe` gegen die vorhandenen Namen ab:
 * - 'exakt': normalisierte Token-Mengen sind gleich → vorhandenen Namen übernehmen
 * - 'aehnlich': bester Treffer, wenn die Eingabe-Tokens Teilmenge des vorhandenen
 *   Namens sind (mind. 4 Zeichen) oder die Levenshtein-Distanz klein ist
 *   (≤ 2 ab Länge 6, sonst ≤ 1) → Rückfrage
 * - 'keiner': neuer Verein
 */
export function findeAehnlichenVerein(eingabe: string, vorhandeneNamen: string[]): VereinsTreffer {
	const eingabeTokens = normalisiereVereinsname(eingabe);
	if (eingabeTokens.length === 0) return { art: 'keiner' };

	// Exakte Treffer; identische Schreibweise (ohne Groß/klein) hat Vorrang.
	const exakte = vorhandeneNamen.filter((n) =>
		gleicheMengen(eingabeTokens, normalisiereVereinsname(n))
	);
	if (exakte.length > 0) {
		const gleich = exakte.find(
			(n) => leerzeichenBereinigen(n).toLowerCase() === leerzeichenBereinigen(eingabe).toLowerCase()
		);
		return { art: 'exakt', name: gleich ?? exakte[0] };
	}

	const eingabeText = eingabeTokens.join(' ');
	const eingabeLaenge = eingabeTokens.join('').length;
	const maxDistanz = eingabeText.length >= 6 ? 2 : 1;

	let bester: { name: string; aehnlichkeit: number } | null = null;
	for (const name of vorhandeneNamen) {
		const tokens = normalisiereVereinsname(name);
		const text = tokens.join(' ');
		const distanz = levenshtein(eingabeText, text);

		const teilmenge = eingabeLaenge >= 4 && eingabeTokens.every((t) => tokens.includes(t));
		const tippfehler = distanz <= maxDistanz;
		if (!teilmenge && !tippfehler) continue;

		const aehnlichkeit = 1 - distanz / Math.max(eingabeText.length, text.length);
		if (!bester || aehnlichkeit > bester.aehnlichkeit) bester = { name, aehnlichkeit };
	}

	return bester ? { art: 'aehnlich', name: bester.name } : { art: 'keiner' };
}

/**
 * Bestandscheck: Paare vorhandener Namen, die sich nur nach Normalisierung bzw.
 * durch Ähnlichkeit unterscheiden. Nur zur Anzeige.
 */
export function findeSchreibvarianten(namen: string[]): [string, string][] {
	const paare: [string, string][] = [];
	for (let i = 0; i < namen.length; i++) {
		for (let j = i + 1; j < namen.length; j++) {
			const hin = findeAehnlichenVerein(namen[i], [namen[j]]);
			const rueck = findeAehnlichenVerein(namen[j], [namen[i]]);
			if (hin.art !== 'keiner' || rueck.art !== 'keiner') paare.push([namen[i], namen[j]]);
		}
	}
	return paare;
}
