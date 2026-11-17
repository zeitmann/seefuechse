<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { RefreshCw } from '@lucide/svelte';
	import { formatiereZeitpunkt } from '$lib/zeit';
	import type { SyncErgebnis } from '$lib/server/spielplanSync';
	import {
		SYNC_INTERVALLE,
		SYNC_INTERVALL_HINWEISE,
		SYNC_INTERVALL_LABELS,
		type SyncIntervall
	} from '$lib/syncIntervall';

	type LetzterSync = {
		gestartetAm: Date;
		quelle: 'cron' | 'manuell';
		erfolgreich: boolean;
		hinweise: string | null;
	};

	let {
		ergebnis,
		terminierungsStichtag,
		letzterSync,
		saison,
		syncIntervall,
		intervallGespeichert,
		intervallFehler
	}: {
		ergebnis: SyncErgebnis | null;
		terminierungsStichtag: string | null;
		letzterSync: LetzterSync | null;
		saison: number;
		syncIntervall: SyncIntervall;
		intervallGespeichert: boolean;
		intervallFehler: string | null;
	} = $props();

	// Aktuelle Auswahl im Select: folgt dem Server-Wert (nach invalidateAll),
	// wird beim Ändern lokal überschrieben, damit Hinweis und Pause-Warnung
	// sofort passen.
	let auswahl = $derived(syncIntervall);
	let intervallSpeichert = $state(false);

	const intervallAbsenden: SubmitFunction = () => {
		intervallSpeichert = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: false });
			} finally {
				intervallSpeichert = false;
				// Bei Fehler zurück auf den gespeicherten Wert
				if (result.type !== 'success') auswahl = syncIntervall;
			}
		};
	};

	// 2026 → '2026/27'
	const saisonText = $derived(`${saison}/${String((saison + 1) % 100).padStart(2, '0')}`);

	const letzterSyncText = $derived(
		letzterSync
			? `${formatiereZeitpunkt(letzterSync.gestartetAm)} (${
					letzterSync.quelle === 'cron' ? 'automatisch' : 'manuell'
				})`
			: null
	);

	// 'JJJJ-MM-TT' → 'TT.MM.JJJJ'
	const stichtagText = $derived(
		terminierungsStichtag ? terminierungsStichtag.split('-').reverse().join('.') : '–'
	);

	let laedt = $state(false);

	const absenden: SubmitFunction = () => {
		laedt = true;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				laedt = false;
			}
		};
	};

	const kennzahlen = $derived(
		ergebnis
			? [
					{ label: 'Neu', wert: ergebnis.neu },
					{ label: 'Geändert', wert: ergebnis.geaendert },
					{ label: 'Unverändert', wert: ergebnis.unveraendert },
					{ label: 'Übersprungen', wert: ergebnis.uebersprungenManuell }
				]
			: []
	);
</script>

<section class="sync-karte">
	<div class="sync-kopf">
		<span class="sync-icon" aria-hidden="true">
			<RefreshCw size={20} class={laedt ? 'dreht' : ''} />
		</span>
		<div class="sync-text">
			<h2>Spielplan-Sync</h2>
			<p>Saison {saisonText} via OpenLigaDB · Bundesliga, DFB-Pokal, Conference League</p>
		</div>
	</div>

	{#if !letzterSync}
		<p class="status-zeile">Noch nicht synchronisiert</p>
	{:else if letzterSync.erfolgreich}
		<p class="status-zeile">
			Zuletzt synchronisiert: <strong>{letzterSyncText}</strong>
		</p>
	{:else}
		<div class="sync-warnung" role="alert">
			<p class="warnung-titel">Letzter Sync fehlgeschlagen</p>
			<p class="warnung-zeit">{letzterSyncText}</p>
			{#if letzterSync.hinweise}
				<p class="warnung-hinweise">{letzterSync.hinweise}</p>
			{/if}
		</div>
	{/if}

	<div class="intervall-bereich">
		<form
			method="POST"
			action="?/syncIntervallSetzen"
			class="intervall-form"
			use:enhance={intervallAbsenden}
		>
			<label class="intervall-zeile">
				<span class="intervall-label">Automatischer Sync</span>
				<select
					class="intervall-select"
					name="intervall"
					bind:value={auswahl}
					aria-busy={intervallSpeichert}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
				>
					{#each SYNC_INTERVALLE as intervall (intervall)}
						<option value={intervall}>{SYNC_INTERVALL_LABELS[intervall]}</option>
					{/each}
				</select>
			</label>
		</form>

		<p class="intervall-hinweis">{SYNC_INTERVALL_HINWEISE[auswahl]}</p>

		{#if auswahl === 'pause'}
			<div class="sync-warnung" role="alert">
				<p class="warnung-titel">Automatischer Sync pausiert</p>
				<p class="warnung-text">
					Spielplan, Ergebnisse und Anstoßzeiten werden nicht mehr aktualisiert. Der Button
					„Jetzt synchronisieren“ funktioniert weiterhin.
				</p>
			</div>
		{/if}

		{#if intervallFehler && !intervallSpeichert}
			<p class="intervall-meldung intervall-fehler" role="alert">{intervallFehler}</p>
		{:else if intervallGespeichert && !intervallSpeichert}
			<p class="intervall-meldung" role="status">Gespeichert</p>
		{/if}
	</div>

	<p class="status-zeile">
		Anstoßzeiten bestätigt bis: <strong>{stichtagText}</strong>
	</p>

	<form method="POST" action="?/synchronisieren" use:enhance={absenden}>
		<button type="submit" class="btn-sync" disabled={laedt}>
			{laedt ? 'Synchronisiere …' : 'Jetzt synchronisieren'}
		</button>
	</form>

	{#if ergebnis && !laedt}
		<div class="sync-ergebnis" role="status">
			<dl class="kennzahlen">
				{#each kennzahlen as { label, wert } (label)}
					<div class="kennzahl">
						<dt>{label}</dt>
						<dd>{wert}</dd>
					</div>
				{/each}
			</dl>

			{#if ergebnis.terminAenderungen.length > 0}
				<p class="termin-hinweis">
					Termin verschoben: {ergebnis.terminAenderungen.length}
					{ergebnis.terminAenderungen.length === 1 ? 'Spiel' : 'Spiele'}
				</p>
			{/if}

			{#if ergebnis.hinweise.length > 0}
				<ul class="hinweise">
					{#each ergebnis.hinweise as hinweis (hinweis)}
						<li>{hinweis}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>

<style>
	.sync-karte {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 14px 16px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: var(--color-surface-raised);
	}

	.sync-kopf {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.sync-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		background: var(--color-info-muted);
		color: var(--color-info);
	}

	.sync-icon :global(.dreht) {
		animation: drehen 1s linear infinite;
	}

	@keyframes drehen {
		to {
			transform: rotate(360deg);
		}
	}

	.sync-text {
		min-width: 0;
	}

	.sync-text h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.sync-text p {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.status-zeile {
		margin: 0;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.status-zeile strong {
		color: var(--color-text);
		font-family: var(--font-mono);
	}

	.sync-warnung {
		padding: 10px 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-accent);
		background: var(--color-accent-muted);
		font-size: 13px;
	}

	.sync-warnung p {
		margin: 0;
	}

	.warnung-titel {
		font-weight: 700;
		color: var(--color-accent);
	}

	.warnung-zeit {
		margin-top: 2px;
		color: var(--color-text-muted);
	}

	.warnung-hinweise {
		margin-top: 6px;
		color: var(--color-text);
		/* Hinweise sind zeilenweise gespeichert */
		white-space: pre-line;
	}

	.warnung-text {
		margin-top: 2px;
		color: var(--color-text);
	}

	form {
		margin: 0;
	}

	.intervall-bereich {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}

	.intervall-zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.intervall-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
	}

	.intervall-select {
		flex-shrink: 0;
		min-width: 0;
		max-width: 60%;
		padding: 8px 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
		/* 16px verhindert das automatische Zoomen in iOS Safari */
		font-size: 16px;
		font-family: inherit;
	}

	.intervall-select:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.intervall-select[aria-busy='true'] {
		opacity: 0.7;
		cursor: progress;
	}

	.intervall-hinweis {
		margin: 0;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.intervall-meldung {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-success);
	}

	.intervall-meldung.intervall-fehler {
		color: var(--color-accent);
	}

	.btn-sync {
		width: 100%;
		padding: 10px 16px;
		border-radius: var(--radius-md);
		border: none;
		background: var(--color-accent);
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.btn-sync:hover,
	.btn-sync:disabled {
		opacity: 0.7;
	}

	.btn-sync:disabled {
		cursor: progress;
	}

	.sync-ergebnis {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.kennzahlen {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		margin: 0;
	}

	.kennzahl {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 8px 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.kennzahl dt {
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.kennzahl dd {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		font-family: var(--font-mono);
	}

	.termin-hinweis {
		margin: 0;
		font-size: 13px;
		color: var(--color-info);
	}

	.hinweise {
		margin: 0;
		padding: 8px 10px 8px 26px;
		border-radius: var(--radius-md);
		background: var(--color-warning-muted);
		color: var(--color-warning);
		font-size: 13px;
	}
</style>
