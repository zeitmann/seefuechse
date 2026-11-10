/** Anzeigetexte für die Enum-Werte von heim_auswaerts. */
export const heimAuswaertsText: Record<string, string> = {
	heim: 'Heim',
	auswaerts: 'Auswärts'
};

/** 'JJJJ-MM-TT' → 'TT.MM.JJJJ' (reine Textumformung, keine Zeitzonen-Effekte). */
export function datumDeutsch(datum: string): string {
	const [jahr, monat, tag] = datum.split('-');
	return `${tag}.${monat}.${jahr}`;
}
