<script>
	import Card from './Card.svelte';
	import { ChevronRight, Clock } from '@lucide/svelte';
	import {
		datumGross,
		datumKurz,
		gastteamName,
		hatErgebnis,
		heimteamName,
		heuteDatum,
		rundeAnzeige
	} from '$lib/spielAnzeige';

	let {
		datum,
		heimAuswaerts,
		wettbewerb,
		gegner,
		uhrzeit = undefined,
		uhrzeitVorlaeufig = false,
		statusBadge,
		runde = null,
		toreHeimteam = null,
		toreGastteam = null
	} = $props();

	const spiel = $derived({ gegner, heimAuswaerts, toreHeimteam, toreGastteam });
	const rundeBlock = $derived(rundeAnzeige(runde));
	const datumBlock = $derived(datumGross(datum));
	const mitErgebnis = $derived(hatErgebnis(spiel));
	const ergebnisText = $derived(
		mitErgebnis
			? `${heimteamName(spiel)} ${toreHeimteam}, ${gastteamName(spiel)} ${toreGastteam}`
			: ''
	);
	// "x frei" nur, solange das Spiel noch bevorsteht
	const zeigeStatus = $derived(Boolean(statusBadge) && !mitErgebnis && datum >= heuteDatum());
	const heimAuswaertsText = $derived(heimAuswaerts === 'heim' ? 'HEIM' : 'AUSWÄRTS');
</script>

<Card>
	<div class="match-card">
		<div class="date-section">
			{#if rundeBlock}
				<div class="date-day" class:runde-text={rundeBlock.klein === null}>{rundeBlock.gross}</div>
				{#if rundeBlock.klein}
					<div class="date-month">{rundeBlock.klein}</div>
				{/if}
			{:else}
				<div class="date-day">{datumBlock.tag}</div>
				<div class="date-month">{datumBlock.monat}</div>
			{/if}
		</div>

		<div class="content-section">
			<div class="badges-row">
				<span class="badge badge-heim">{heimAuswaertsText}</span>
				<span class="badge badge-wettbewerb">{wettbewerb.toUpperCase()}</span>
			</div>
			<h3 class="gegner">{gegner}</h3>
			{#if rundeBlock || uhrzeit}
				<div class="time-row">
					<Clock size={16} />
					<span>{datumKurz(datum)}{#if uhrzeit}&nbsp;· {uhrzeit} Uhr{/if}</span>
					{#if uhrzeit && uhrzeitVorlaeufig}
						<span class="vorlaeufig" title="Anstoßzeit noch nicht von der DFL bestätigt">
							vorläufig
						</span>
					{/if}
				</div>
			{/if}
		</div>

		<div class="status-section">
			{#if mitErgebnis}
				<span class="ergebnis">
					<span aria-hidden="true">{toreHeimteam} : {toreGastteam}</span>
					<span class="sr-only">{ergebnisText}</span>
				</span>
			{:else if zeigeStatus}
				<span class="badge badge-status">{statusBadge}</span>
			{/if}
			<ChevronRight size={20} />
		</div>
	</div>
</Card>

<style>
	.match-card {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.date-section {
		flex-shrink: 0;
		/* Feste Breite, damit Spieltag, Runde und Datum in der Liste fluchten */
		width: 56px;
		text-align: center;
		font-family: var(--font-mono);
	}

	.date-day {
		font-size: 32px;
		font-weight: 600;
		line-height: 1;
		color: var(--color-text);
	}

	/* Runde ohne Nummer ('Achtelfinale'): kleiner und umbrechbar */
	.date-day.runde-text {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 700;
		line-height: 1.2;
		hyphens: auto;
		overflow-wrap: anywhere;
	}

	.date-month {
		font-size: 12px;
		color: var(--color-text-muted);
		margin-top: 4px;
		overflow-wrap: anywhere;
	}

	.content-section {
		flex: 1;
		min-width: 0;
	}

	.badges-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 8px;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.5px;
		/* Lange Wettbewerbe ('CONFERENCE LEAGUE') nicht im Badge umbrechen */
		white-space: nowrap;
	}

	.badge-heim {
		background-color: var(--badge-heim-bg);
		color: var(--badge-heim-text);
		border: 1px solid var(--badge-heim-bg);
	}

	.badge-wettbewerb {
		background-color: var(--badge-wettbewerb-bg);
		color: var(--badge-wettbewerb-text);
		border: 1px solid var(--badge-wettbewerb-bg);
	}

	.gegner {
		font-size: 16px;
		font-weight: 600;
		margin: 0;
		color: var(--color-text);
		margin-bottom: 8px;
	}

	.time-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: var(--color-text-muted);
	}

	.vorlaeufig {
		padding: 1px 6px;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-full);
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.status-section {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-muted);
	}

	.ergebnis {
		font-family: var(--font-mono);
		font-size: 20px;
		font-weight: 700;
		color: var(--color-text);
		white-space: nowrap;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.badge-status {
		background-color: var(--badge-status-bg);
		color: var(--badge-status-text);
		border: 1px solid var(--badge-status-bg);
	}
</style>
