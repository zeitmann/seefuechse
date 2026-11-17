// src/lib/syncIntervall.ts
//
// Werte, Labels und Hinweistexte zum Intervall des automatischen Spielplan-Syncs.
// Liegt bewusst außerhalb von src/lib/server/, weil auch die Sync-Karte in
// /verwaltung (Client) sie braucht. Die Logik steht in $lib/server/syncEinstellung.

export const SYNC_INTERVALLE = [
	'stuendlich',
	'taeglich',
	'alle_zwei_tage',
	'woechentlich',
	'pause'
] as const;

export type SyncIntervall = (typeof SYNC_INTERVALLE)[number];

export const STANDARD_SYNC_INTERVALL: SyncIntervall = 'stuendlich';

export const SYNC_INTERVALL_LABELS: Record<SyncIntervall, string> = {
	stuendlich: 'Stündlich',
	taeglich: 'Täglich',
	alle_zwei_tage: 'Alle zwei Tage',
	woechentlich: 'Wöchentlich',
	pause: 'Pause'
};

/** Kurzer Erklärtext zur Auswahl für die Verwaltung. */
export const SYNC_INTERVALL_HINWEISE: Record<SyncIntervall, string> = {
	stuendlich: 'Synchronisiert zu jedem Cron-Slot: frühmorgens und ab mittags stündlich bis Mitternacht.',
	taeglich: 'Prüft zu jedem Cron-Slot, ob ein Sync fällig ist, und läuft höchstens einmal pro Tag.',
	alle_zwei_tage:
		'Prüft zu jedem Cron-Slot, ob ein Sync fällig ist, und läuft höchstens alle zwei Tage.',
	woechentlich:
		'Prüft zu jedem Cron-Slot, ob ein Sync fällig ist, und läuft höchstens einmal pro Woche.',
	pause: 'Der automatische Sync ist ausgeschaltet.'
};

export function istSyncIntervall(wert: unknown): wert is SyncIntervall {
	return typeof wert === 'string' && (SYNC_INTERVALLE as readonly string[]).includes(wert);
}
