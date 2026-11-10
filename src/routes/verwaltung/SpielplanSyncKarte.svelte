<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { RefreshCw } from '@lucide/svelte';
	import { formatiereZeitpunkt } from '$lib/zeit';
	import type { SyncErgebnis } from '$lib/server/spielplanSync';

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
		saison
	}: {
		ergebnis: SyncErgebnis | null;
		terminierungsStichtag: string | null;
		letzterSync: LetzterSync | null;
		saison: number;
	} = $props();

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

	form {
		margin: 0;
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
