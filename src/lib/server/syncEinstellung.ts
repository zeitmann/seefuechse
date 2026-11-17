// src/lib/server/syncEinstellung.ts
//
// Steuert, wie oft der automatische Spielplan-Sync tatsächlich läuft. Die Netlify
// Scheduled Function ruft den Cron-Endpoint weiterhin nach festem Zeitplan auf
// (0 4,12-23 * * * UTC); der Endpoint entscheidet anhand der Einstellung
// 'sync_intervall' in der Tabelle `einstellungen`, ob er synchronisiert.

import { desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { einstellungen, syncLaeufe } from '$lib/server/db/schema';

import {
	STANDARD_SYNC_INTERVALL,
	istSyncIntervall,
	type SyncIntervall
} from '$lib/syncIntervall';

// Werte, Labels und Prüffunktion liegen in $lib/syncIntervall (auch im Client
// gebraucht) und werden hier für serverseitige Aufrufer weitergereicht.
export {
	SYNC_INTERVALLE,
	SYNC_INTERVALL_LABELS,
	STANDARD_SYNC_INTERVALL,
	istSyncIntervall,
	type SyncIntervall
} from '$lib/syncIntervall';

const SCHLUESSEL_SYNC_INTERVALL = 'sync_intervall';

/**
 * Mindestabstand in Stunden zum letzten Cron-Lauf. Jeweils 1 Stunde Toleranz,
 * weil `sync_laeufe.gestartet_am` faktisch der Endzeitpunkt des Laufs ist
 * (Insert nach dem Sync) und der nächste Cron-Slot sonst knapp verfehlt würde.
 * 'pause' hat keinen Abstand, dort läuft der automatische Sync nie.
 */
export const SYNC_MINDESTABSTAND_STUNDEN: Record<Exclude<SyncIntervall, 'pause'>, number> = {
	stuendlich: 0,
	taeglich: 23,
	alle_zwei_tage: 47,
	woechentlich: 167
};

/** Liest das eingestellte Intervall; fehlt der Eintrag oder ist er ungültig: 'stuendlich'. */
export async function holeSyncIntervall(): Promise<SyncIntervall> {
	const eintrag = await db.query.einstellungen.findFirst({
		columns: { wert: true },
		where: eq(einstellungen.schluessel, SCHLUESSEL_SYNC_INTERVALL)
	});
	const wert = eintrag?.wert;
	return istSyncIntervall(wert) ? wert : STANDARD_SYNC_INTERVALL;
}

/** Speichert das Intervall (Upsert). Wirft bei einem ungültigen Wert. */
export async function setzeSyncIntervall(wert: string): Promise<void> {
	if (!istSyncIntervall(wert)) {
		throw new Error(`Ungültiges Sync-Intervall: ${wert}`);
	}
	await db
		.insert(einstellungen)
		.values({ schluessel: SCHLUESSEL_SYNC_INTERVALL, wert })
		.onConflictDoUpdate({
			target: einstellungen.schluessel,
			set: { wert, geaendertAm: sql`now()` }
		});
}

export type SyncEntscheidung =
	| { laufen: true }
	| { laufen: false; grund: 'pause' | 'intervall' };

/**
 * Entscheidet, ob der Cron-Endpoint jetzt synchronisieren soll. Maßgeblich ist
 * nur der letzte Lauf mit quelle = 'cron' (erfolgreich oder nicht); manuelle
 * Läufe verschieben den automatischen Rhythmus nicht.
 */
export async function sollAutomatischSynchronisieren(): Promise<SyncEntscheidung> {
	const intervall = await holeSyncIntervall();
	if (intervall === 'pause') return { laufen: false, grund: 'pause' };

	const mindestabstand = SYNC_MINDESTABSTAND_STUNDEN[intervall];
	if (mindestabstand === 0) return { laufen: true };

	const letzterCronLauf = await db.query.syncLaeufe.findFirst({
		columns: { gestartetAm: true },
		where: eq(syncLaeufe.quelle, 'cron'),
		orderBy: desc(syncLaeufe.gestartetAm)
	});
	if (!letzterCronLauf) return { laufen: true };

	const abstandStunden = (Date.now() - letzterCronLauf.gestartetAm.getTime()) / 3_600_000;
	return abstandStunden >= mindestabstand
		? { laufen: true }
		: { laufen: false, grund: 'intervall' };
}
